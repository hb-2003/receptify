from django.http import HttpResponse, JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from calls.models import Call, CallEvent


class TwilioTwiMLView(APIView):
    """
    Public webhook that Twilio calls when an outbound phone call is answered.
    Responds with static TwiML (XML) instructing Twilio to Say a test message.
    """
    # AllowAny permissions ensure that Twilio's webhook requests can hit this endpoint successfully.
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        twiml_content = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<Response>\n'
            '    <Say voice="alice">Hello, this is a test from Receptify.</Say>\n'
            '</Response>'
        )
        return HttpResponse(twiml_content, content_type="application/xml")


class TwilioCallTwiMLView(APIView):
    """
    Public TwiML webhook specific to an active Call ID.
    When a customer answers, this is invoked by Twilio.
    Sets Call status to 'in_progress' and streams dynamic script instructions.
    """
    permission_classes = [AllowAny]

    def post(self, request, id, *args, **kwargs):
        try:
            call = Call.objects.get(id=id)
        except Call.DoesNotExist:
            return HttpResponse('<Response><Hangup/></Response>', content_type="application/xml")

        # Update status to in_progress upon being answered
        call.status = 'in_progress'
        call.save()

        # Log answer event
        CallEvent.objects.create(
            call=call,
            event_type='answered',
            payload=request.data
        )

        # Retrieve dynamic script text from the campaign profile
        script_text = call.campaign.script_text or "Hello, this is a call from Receptify."
        twiml_content = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<Response>\n'
            f'    <Say voice="alice">{script_text}</Say>\n'
            '</Response>'
        )
        return HttpResponse(twiml_content, content_type="application/xml")


class TwilioCallStatusView(APIView):
    """
    Public webhook callback called by Twilio on call state transitions (ringing, completed, failed, etc.).
    Updates database records with exact durations, outcomes, and logs historical CallEvents.
    """
    permission_classes = [AllowAny]

    def post(self, request, id, *args, **kwargs):
        try:
            call = Call.objects.get(id=id)
        except Call.DoesNotExist:
            return HttpResponse("Call not found", status=404)

        # Parse url-encoded Twilio status callback parameters
        call_status = request.data.get('CallStatus', '').lower()
        call_duration = request.data.get('CallDuration')

        # Map Twilio call statuses to Receptify DB statuses
        status_mapping = {
            'queued': 'queued',
            'ringing': 'ringing',
            'in-progress': 'in_progress',
            'completed': 'completed',
            'busy': 'failed',
            'failed': 'failed',
            'no-answer': 'failed',
            'canceled': 'failed'
        }

        if call_status in status_mapping:
            call.status = status_mapping[call_status]

        if call_duration:
            try:
                call.duration_sec = int(call_duration)
            except ValueError:
                pass

        # Evaluate outcome metrics
        if call_status == 'completed':
            call.outcome = 'completed'
        elif call_status == 'busy':
            call.outcome = 'busy'
        elif call_status == 'no-answer':
            call.outcome = 'no_answer'
        elif call_status == 'failed':
            call.outcome = 'failed'
        elif call_status == 'canceled':
            call.outcome = 'canceled'

        call.save()

        # Log transition event
        CallEvent.objects.create(
            call=call,
            event_type=f'twilio_{call_status}',
            payload=request.data
        )

        return JsonResponse({'success': True})
