from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from calls.models import Call, CallTranscript, CallRecording
from calls.serializers import CallSerializer, CallTranscriptSerializer, CallRecordingSerializer
from customers.models import Customer
from customers.serializers import CustomerSerializer
from campaigns.models import Campaign
from campaigns.serializers import CampaignSerializer
from customers.views import to_camel_case

class CallListView(APIView):
    def get(self, request):
        user = request.user
        if not user.business_id:
            return Response({'calls': []}, status=status.HTTP_200_OK)

        status_filter = request.query_params.get('status', '').strip()
        outcome_filter = request.query_params.get('outcome', '').strip()
        campaign_id = request.query_params.get('campaignId', '').strip()

        # Build optimized query selecting related customer and campaign records
        queryset = Call.objects.filter(campaign__business_id=user.business_id).select_related('customer', 'campaign')

        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if outcome_filter:
            queryset = queryset.filter(outcome=outcome_filter)
        if campaign_id:
            queryset = queryset.filter(campaign_id=campaign_id)

        queryset = queryset.order_by('-created_at')[:500]

        serializer = CallSerializer(queryset, many=True)
        return Response({'calls': [to_camel_case(c) for c in serializer.data]}, status=status.HTTP_200_OK)


class CallDetailView(APIView):
    def get(self, request, id):
        user = request.user
        try:
            # Query call record
            call = Call.objects.get(id=id)
        except Call.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            # Verify owner permissions
            campaign = Campaign.objects.get(id=call.campaign_id, business_id=user.business_id)
        except Campaign.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            customer = Customer.objects.get(id=call.customer_id)
        except Customer.DoesNotExist:
            customer = None

        # Fetch optional transcript and recording records
        try:
            transcript = CallTranscript.objects.get(call_id=id)
        except CallTranscript.DoesNotExist:
            transcript = None

        try:
            recording = CallRecording.objects.get(call_id=id)
        except CallRecording.DoesNotExist:
            recording = None

        # Serializations
        call_serializer = CallSerializer(call)
        customer_serializer = CustomerSerializer(customer) if customer else None
        campaign_serializer = CampaignSerializer(campaign)
        transcript_serializer = CallTranscriptSerializer(transcript) if transcript else None
        recording_serializer = CallRecordingSerializer(recording) if recording else None

        return Response({
            'call': to_camel_case(call_serializer.data),
            'customer': to_camel_case(customer_serializer.data) if customer_serializer else None,
            'campaign': to_camel_case(campaign_serializer.data),
            'transcript': to_camel_case(transcript_serializer.data) if transcript_serializer else None,
            'recording': to_camel_case(recording_serializer.data) if recording_serializer else None
        }, status=status.HTTP_200_OK)


class TestCallView(APIView):
    """
    Endpoint supporting live pre-launch test calling for business owners to verify AI voice setups.
    Defensively spawns atomic transient records and dispatches the call immediately via Twilio.
    """
    def post(self, request):
        user = request.user
        business_id = user.business_id
        if not business_id:
            return Response({'error': 'No business profile found'}, status=status.HTTP_400_BAD_REQUEST)

        to_phone = request.data.get('phoneNumber', '').strip() or request.data.get('phone_number', '').strip()
        script_text = request.data.get('scriptText', '').strip() or request.data.get('script_text', '').strip()

        if not to_phone or not script_text:
            return Response({'error': 'Missing phone number or script text'}, status=status.HTTP_400_BAD_REQUEST)

        from calls.utils_twilio import initiate_twilio_call
        from django.db import transaction

        try:
            with transaction.atomic():
                # Spin up transient test-call records
                campaign = Campaign.objects.create(
                    business_id=business_id,
                    name="Pre-launch Test Call",
                    purpose="test_call",
                    script_text=script_text,
                    status="completed"
                )
                customer = Customer.objects.create(
                    business_id=business_id,
                    full_name="Test Recipient",
                    phone=to_phone,
                    consent_status="granted"
                )
                call = Call.objects.create(
                    campaign=campaign,
                    customer=customer,
                    status="queued"
                )
        except Exception as e:
            return Response({'error': f'Failed to set up transient test records: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Trigger outbound telephony dispatch using our core Twilio caller utility
        res = initiate_twilio_call(str(call.id))
        
        if 'error' in res:
            return Response({'error': res['error']}, status=status.HTTP_400_BAD_REQUEST)
            
        return Response({'success': True, 'callId': str(call.id)}, status=status.HTTP_200_OK)
