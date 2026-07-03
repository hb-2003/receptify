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
