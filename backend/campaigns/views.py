import re
import uuid
import random
import time
import threading
from django.db import transaction
from django.db.models import F
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from campaigns.models import Campaign, CampaignCustomer, Template, Script
from campaigns.serializers import CampaignSerializer, TemplateSerializer
from customers.models import Customer
from customers.serializers import CustomerSerializer
from calls.models import Call, CallTranscript, CallRecording
from customers.views import to_camel_case


from receptify.models import TwilioCredentials

# NOTE: The mock calling simulator thread (run_mock_campaign) and its utilities (OUTCOMES,
# pick_outcome, mock_transcript, mock_summary) have been completely removed for KAN-17.
# We now transition campaigns to 'scheduled' status and queue them for live outbound dialer processing.


class CampaignListCreateView(APIView):
    def get(self, request):
        user = request.user
        campaigns = Campaign.objects.filter(business_id=user.business_id).order_by('-created_at')
        serializer = CampaignSerializer(campaigns, many=True)
        return Response({'campaigns': to_camel_case(serializer.data)}, status=status.HTTP_200_OK)

    def post(self, request):
        user = request.user
        if not user.business_id:
            return Response({'error': 'No business associated with user'}, status=status.HTTP_400_BAD_REQUEST)

        # Parse camelCase request body
        name = request.data.get('name', '').strip()
        purpose = request.data.get('purpose', 'custom').strip()
        language = request.data.get('language', 'en').strip()
        voice_type = request.data.get('voiceType', 'female_professional').strip()
        script_text = request.data.get('scriptText', '').strip()
        customer_ids = request.data.get('customerIds', [])
        scheduled_at = request.data.get('scheduledAt')
        calling_window_start = request.data.get('callingWindowStart', '09:00').strip()
        calling_window_end = request.data.get('callingWindowEnd', '19:00').strip()
        retry_attempts = request.data.get('retryAttempts', 2)
        delay_between_calls = request.data.get('delayBetweenCalls', 5)
        is_compliance_confirmed = request.data.get('complianceConfirmed', False)

        if not name:
            return Response({'error': 'Campaign name is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                campaign = Campaign.objects.create(
                    business_id=user.business_id,
                    name=name,
                    purpose=purpose,
                    language=language,
                    voice_type=voice_type,
                    script_text=script_text if script_text else None,
                    scheduled_at=scheduled_at if scheduled_at else None,
                    calling_window_start=calling_window_start,
                    calling_window_end=calling_window_end,
                    retry_attempts=retry_attempts,
                    delay_between_calls=delay_between_calls,
                    is_compliance_confirmed=is_compliance_confirmed,
                    total_contacts=len(customer_ids),
                    status='draft'
                )

                # Link associated customers
                campaign_customer_relationships = []
                for customer_id in customer_ids:
                    campaign_customer_relationships.append(CampaignCustomer(campaign=campaign, customer_id=customer_id))
                
                if campaign_customer_relationships:
                    CampaignCustomer.objects.bulk_create(campaign_customer_relationships)

            serializer = CampaignSerializer(campaign)
            return Response({'campaign': to_camel_case(serializer.data)}, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CampaignDetailView(APIView):
    def get(self, request, id):
        user = request.user
        try:
            campaign = Campaign.objects.get(id=id, business_id=user.business_id)
        except Campaign.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        # Get associated customers
        campaign_customer_relationships = CampaignCustomer.objects.filter(campaign_id=id)
        customer_ids = [relationship.customer_id for relationship in campaign_customer_relationships]
        customers = Customer.objects.filter(id__in=customer_ids)

        # Get call history for this campaign
        calls = Call.objects.filter(campaign_id=id).select_related('customer', 'campaign').order_by('-created_at')

        # Serializations
        campaign_serializer = CampaignSerializer(campaign)
        customer_serializer = CustomerSerializer(customers, many=True)
        
        # Lazy import of CallSerializer to avoid mutual circular dependencies
        from calls.serializers import CallSerializer
        calls_serializer = CallSerializer(calls, many=True)

        return Response({
            'campaign': to_camel_case(campaign_serializer.data),
            'customers': [to_camel_case(customer_item) for customer_item in customer_serializer.data],
            'calls': [to_camel_case(call_item) for call_item in calls_serializer.data]
        }, status=status.HTTP_200_OK)

    def delete(self, request, id):
        user = request.user
        try:
            campaign = Campaign.objects.get(id=id, business_id=user.business_id)
            campaign.delete()
            return Response({'ok': True}, status=status.HTTP_200_OK)
        except Campaign.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


class CampaignLaunchView(APIView):
    def post(self, request, id):
        user = request.user
        try:
            # We use an atomic transaction with a database-level lock (select_for_update)
            # to make sure only one request can inspect and launch this campaign at a time.
            # This completely stops concurrent launch clicks from starting double calling threads.
            with transaction.atomic():
                campaign = Campaign.objects.select_for_update().get(id=id, business_id=user.business_id)

                # Validate compliance agreement has been checked
                if not campaign.is_compliance_confirmed:
                    return Response({'error': 'Compliance confirmation required before launch'}, status=status.HTTP_400_BAD_REQUEST)

                # Validate that only draft campaigns can be launched/scheduled
                if campaign.status != 'draft':
                    return Response({'error': 'Only draft campaigns can be launched.'}, status=status.HTTP_400_BAD_REQUEST)

                # Validate that Twilio credentials are configured for this business
                if not TwilioCredentials.objects.filter(business_id=user.business_id).exists():
                    return Response({'error': 'No Twilio credentials configured for your business. Please set them up in settings first.'}, status=status.HTTP_400_BAD_REQUEST)

                # Fetch associated contacts to make sure the campaign is not empty
                campaign_customers = CampaignCustomer.objects.filter(campaign_id=campaign.id)
                if not campaign_customers.exists():
                    return Response({'error': 'Cannot launch a campaign with no contacts. Please add customers to this campaign first.'}, status=status.HTTP_400_BAD_REQUEST)

                # Validate that the business has sufficient call credits
                contacts_count = campaign_customers.count()
                if not user.business or user.business.call_credits < contacts_count:
                    available_credits = user.business.call_credits if user.business else 0
                    return Response({'error': f'Insufficient call credits. You need at least {contacts_count} credits, but only have {available_credits} left.'}, status=status.HTTP_400_BAD_REQUEST)

                # Set campaign status to scheduled and use Live Twilio channel type
                campaign.status = 'scheduled'
                campaign.channel_type = 1
                campaign.total_contacts = campaign_customers.count()
                campaign.calls_completed = 0
                campaign.calls_answered = 0
                campaign.calls_failed = 0
                campaign.save()

                # Deduct calling credits atomically from the business balance
                business = user.business
                business.call_credits = F('call_credits') - contacts_count
                business.save()

                # Generate initial queued calls for poller processing
                queued_calls = []
                for campaign_customer in campaign_customers:
                    queued_calls.append(
                        Call(
                            campaign_id=campaign.id,
                            customer_id=campaign_customer.customer_id,
                            status='queued',
                            outcome='pending',
                            attempt_number=1,
                            duration_sec=0,
                            channel_type=1 # Live Twilio
                        )
                    )

                # Bulk save call records atomically
                Call.objects.bulk_create(queued_calls)

            # Kick off the live background dialer thread immediately after committing the transaction
            import threading
            from campaigns.dialer import run_live_campaign_dialer
            thread = threading.Thread(target=run_live_campaign_dialer, args=(campaign.id,), daemon=True)
            thread.start()

        except Campaign.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = CampaignSerializer(campaign)
        return Response({'campaign': to_camel_case(serializer.data)}, status=status.HTTP_200_OK)


class TemplateListCreateView(APIView):
    def get(self, request):
        templates = Template.objects.all().order_by('name')
        serializer = TemplateSerializer(templates, many=True)
        return Response({'templates': to_camel_case(serializer.data)}, status=status.HTTP_200_OK)

    def post(self, request):
        name = request.data.get('name')
        industry = request.data.get('industry')
        purpose = request.data.get('purpose')
        language = request.data.get('language', 'en')
        preview = request.data.get('preview')
        body = request.data.get('body')

        template = Template.objects.create(
            name=name,
            industry=industry,
            purpose=purpose,
            language=language,
            preview=preview,
            body=body
        )
        serializer = TemplateSerializer(template)
        return Response({'template': to_camel_case(serializer.data)}, status=status.HTTP_201_CREATED)
