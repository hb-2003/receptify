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


# Mock Calling Engine Outcomes and Weights
OUTCOMES = [
    {'outcome': 'interested', 'status': 'completed', 'weight': 18},
    {'outcome': 'callback_requested', 'status': 'completed', 'weight': 14},
    {'outcome': 'payment_promised', 'status': 'completed', 'weight': 10},
    {'outcome': 'appointment_confirmed', 'status': 'completed', 'weight': 12},
    {'outcome': 'not_interested', 'status': 'completed', 'weight': 12},
    {'outcome': 'no_answer', 'status': 'no_answer', 'weight': 18},
    {'outcome': 'wrong_number', 'status': 'failed', 'weight': 6},
    {'outcome': 'failed', 'status': 'failed', 'weight': 10},
]

def pick_outcome():
    total_weight = sum(o['weight'] for o in OUTCOMES)
    r = random.uniform(0, total_weight)
    for o in OUTCOMES:
        r -= o['weight']
        if r <= 0:
            return o
    return OUTCOMES[0]

def mock_transcript(customer_name, business_name, purpose, language, outcome):
    if language == 'hi':
        intro = f"AI: Namaste {customer_name} ji, main {business_name} se baat kar raha hoon.\nCustomer: Haan, boliye."
    elif language == 'gu':
        intro = f"AI: Namaste {customer_name}, hu {business_name} thi vaat karu chu.\nCustomer: Haan, kahevu chhu."
    else:
        intro = f"AI: Hello {customer_name}, this is a call from {business_name}.\nCustomer: Yes, please go ahead."

    purpose_map = {
        'payment_reminder': 'AI: This is a gentle reminder regarding your upcoming payment due soon.',
        'appointment_reminder': 'AI: I am calling to remind you about your upcoming appointment with us.',
        'lead_followup': 'AI: You had enquired with us recently. I wanted to follow up.',
        'feedback': 'AI: We would love to get your quick feedback on our service.',
        'event_reminder': 'AI: This is a reminder for the upcoming event you registered for.',
        'service_renewal': 'AI: Your service is up for renewal soon — wanted to share the renewal details.',
        'cod_confirmation': 'AI: I am calling to confirm your COD order before we dispatch.',
        'renewal_reminder': 'AI: Your subscription is due for renewal — want to confirm if you would like to continue.',
        'reactivation': 'AI: We noticed you have been away for a while — we have something special for you.',
        'custom': 'AI: I am calling to share important information with you.',
    }
    purpose_line = purpose_map.get(purpose, '')

    outcome_map = {
        'interested': 'Customer: Yes, I am interested. Please send the details.',
        'callback_requested': 'Customer: I am busy right now, please call back later.',
        'payment_promised': 'Customer: I will make the payment by tomorrow.',
        'appointment_confirmed': 'Customer: Yes, I will be there at the scheduled time.',
        'not_interested': 'Customer: Thank you, but I am not interested right now.',
        'no_answer': '(No response — call dropped.)',
        'wrong_number': 'Customer: You have the wrong number.',
        'failed': '(Call could not connect.)',
    }
    outcome_reply = outcome_map.get(outcome, '')

    closing = 'AI: Thank you for your time. Have a great day!'
    return f"{intro}\n{purpose_line}\n{outcome_reply}\n{closing}"

def mock_summary(outcome):
    summary_map = {
        'interested': 'Customer expressed clear interest. Recommend follow-up with detailed offer.',
        'callback_requested': 'Customer requested a callback. Schedule for later today.',
        'payment_promised': 'Customer committed to payment by next working day.',
        'appointment_confirmed': 'Appointment confirmed by customer.',
        'not_interested': 'Customer declined politely. No follow-up needed.',
        'no_answer': 'No response from customer. Retry as per campaign policy.',
        'wrong_number': 'Number does not belong to the intended customer. Update CRM.',
        'failed': 'Call could not be connected due to network or carrier issue.',
    }
    return summary_map.get(outcome, 'Call pending.')


# Asynchronous Mock Call Simulator Worker
def run_mock_campaign(campaign_id):
    try:
        time.sleep(1) # Subtle buffer for launching transition
        campaign = Campaign.objects.get(id=campaign_id)
        
        # Get associated customers
        cc_list = CampaignCustomer.objects.filter(campaign_id=campaign_id)
        
        # Initialize campaign status
        campaign.status = 'running'
        campaign.total_contacts = len(cc_list)
        campaign.calls_completed = 0
        campaign.calls_answered = 0
        campaign.calls_failed = 0
        campaign.save()

        # Create queued call rows
        calls = []
        for cc in cc_list:
            calls.append(
                Call(
                    campaign_id=cc.campaign_id,
                    customer_id=cc.customer_id,
                    status='queued',
                    outcome='pending',
                    attempt_number=1,
                    duration_sec=0
                )
            )
        
        with transaction.atomic():
            created_calls = Call.objects.bulk_create(calls)

        # Progressively simulate each call
        for call in created_calls:
            # 1. Ringing
            call.status = 'ringing'
            call.save()
            time.sleep(random.uniform(0.4, 0.8))

            # 2. In progress
            choice = pick_outcome()
            call.status = 'in_progress'
            call.save()
            time.sleep(random.uniform(0.5, 1.3))

            # 3. Decision & Completed
            duration = random.randint(35, 125) if choice['status'] == 'completed' else (
                random.randint(5, 15) if choice['status'] == 'no_answer' else random.randint(3, 9)
            )
            
            call.duration_sec = duration
            call.outcome = choice['outcome']
            call.status = choice['status']
            call.save()

            # Generate Recording & Transcript
            if choice['status'] == 'completed':
                customer = Customer.objects.get(id=call.customer_id)
                transcript_text = mock_transcript(
                    customer.full_name,
                    campaign.business.name if campaign.business else 'our team',
                    campaign.purpose,
                    campaign.language,
                    choice['outcome']
                )

                # Save transcription and audio record
                CallTranscript.objects.create(
                    call=call,
                    text=transcript_text,
                    summary=mock_summary(choice['outcome'])
                )
                CallRecording.objects.create(
                    call=call,
                    audio_url='/audio/sample-recording.wav',
                    duration_sec=duration
                )

            # Update Campaign stats atomically
            campaign = Campaign.objects.get(id=campaign_id)
            campaign.calls_completed = F('calls_completed') + 1
            if choice['status'] == 'completed':
                campaign.calls_answered = F('calls_answered') + 1
            if choice['status'] == 'failed':
                campaign.calls_failed = F('calls_failed') + 1
            campaign.save()

            time.sleep(0.2)

        # Set campaign final status
        campaign = Campaign.objects.get(id=campaign_id)
        if campaign.calls_completed >= campaign.total_contacts:
            campaign.status = 'completed'
            campaign.save()

    except Exception as e:
        # If the background simulation breaks unexpectedly, we mark the campaign
        # as failed so it doesn't get stuck in 'running' forever. This allows the
        # user to troubleshoot and try launching again.
        print(f"Error running mock campaign: {str(e)}")
        try:
            campaign = Campaign.objects.get(id=campaign_id)
            campaign.status = 'failed'
            campaign.save()
        except Exception as inner_e:
            print(f"Failed to update campaign status to failed: {str(inner_e)}")


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
        calls = Call.objects.filter(campaign_id=id).order_by('-created_at')

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

                if not campaign.is_compliance_confirmed:
                    return Response({'error': 'Compliance confirmation required before launch'}, status=status.HTTP_400_BAD_REQUEST)

                if campaign.status == 'running':
                    serializer = CampaignSerializer(campaign)
                    return Response({'campaign': to_camel_case(serializer.data), 'alreadyRunning': True}, status=status.HTTP_200_OK)

                # Set the status to running inside the locked transaction immediately
                campaign.status = 'running'
                campaign.save()

        except Campaign.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        # Fire and forget Campaign simulation in separate background thread
        threading.Thread(target=run_mock_campaign, args=(campaign.id,)).start()

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
