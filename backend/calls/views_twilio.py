import hmac
import hashlib
import base64
from django.http import HttpResponse
from django.conf import settings
from rest_framework.views import APIView
from rest_framework import status
from calls.models import Call, CallEvent
from receptify.models import TwilioCredentials
from receptify.crypto import decrypt

# Manually verifies that incoming requests actually came from Twilio,
# stopping malicious users from spoofing calling webhooks or logs.
def verify_twilio_signature(url: str, post_data: dict, auth_token: str, signature: str) -> bool:
    # Concatenate the URL and all POST form key-value pairs sorted alphabetically
    data = url
    for key in sorted(post_data.keys()):
        data += key + str(post_data[key])
        
    # Generate the HMAC-SHA1 signature using the business's decrypted Auth Token
    computed_sig = base64.b64encode(
        hmac.new(auth_token.encode('utf-8'), data.encode('utf-8'), hashlib.sha1).digest()
    ).decode('utf-8')
    
    return hmac.compare_digest(computed_sig, signature)


# Returns the TwiML instructions that Twilio reads when a customer answers our call.
class TwimlVoiceView(APIView):
    # Allow public access since Twilio's calling network needs to fetch this without local cookie auth
    authentication_classes = []
    permission_classes = []

    def post(self, request, call_id=None):
        # Fall back to checking query parameters if the call_id wasn't in the path
        resolved_call_id = call_id or request.query_params.get('call_id')
        if not resolved_call_id:
            return HttpResponse("<Response><Hangup/></Response>", content_type="application/xml", status=status.HTTP_400_BAD_REQUEST)

        # Look up the Call record in our database
        try:
            call = Call.objects.get(id=resolved_call_id)
        except Call.DoesNotExist:
            return HttpResponse("<Response><Hangup/></Response>", content_type="application/xml", status=status.HTTP_404_NOT_FOUND)

        # Retrieve the business credentials to run signature verification
        try:
            credentials = TwilioCredentials.objects.get(business_id=call.campaign.business_id)
            auth_token = decrypt(credentials.auth_token)
        except TwilioCredentials.DoesNotExist:
            auth_token = None

        # Verify signature to ensure the request is authentically from Twilio.
        # In production (DEBUG is False), signature validation is strictly enforced.
        signature = request.headers.get('X-Twilio-Signature')
        if not settings.DEBUG:
            if not signature or not auth_token:
                return HttpResponse("<Response><Reject/></Response>", content_type="application/xml", status=status.HTTP_403_FORBIDDEN)

        if signature and auth_token:
            # Reconstruct the absolute URL requested by Twilio
            absolute_url = request.build_absolute_uri()
            # If our server is behind an Nginx or platform proxy, ensure we use https if forwarded
            if request.headers.get('X-Forwarded-Proto') == 'https':
                absolute_url = absolute_url.replace('http://', 'https://')
                
            if not verify_twilio_signature(absolute_url, request.POST, auth_token, signature):
                return HttpResponse("<Response><Reject/></Response>", content_type="application/xml", status=status.HTTP_403_FORBIDDEN)

        # Log an initial answered or active event
        CallEvent.objects.create(
            call=call,
            event_type="twiml_fetched",
            payload={"absolute_url": request.build_absolute_uri()}
        )

        # For Step 2, we return a simple Say TwiML block.
        # This will be upgraded in Step 3 to connect a live WebSocket media stream.
        twiml_content = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Hello, this is a test from Receptify.</Say>
</Response>"""

        return HttpResponse(twiml_content, content_type="application/xml")


# Receives call status callback notifications (like busy, completed, no-answer) from Twilio.
class TwilioStatusCallbackView(APIView):
    # Public endpoint allowing Twilio callback events without cookie auth
    authentication_classes = []
    permission_classes = []

    def post(self, request, call_id=None):
        resolved_call_id = call_id or request.query_params.get('call_id')
        if not resolved_call_id:
            return HttpResponse("Missing call_id", status=status.HTTP_400_BAD_REQUEST)

        try:
            call = Call.objects.get(id=resolved_call_id)
        except Call.DoesNotExist:
            return HttpResponse("Call not found", status=status.HTTP_404_NOT_FOUND)

        # Fetch credentials for security validation
        try:
            credentials = TwilioCredentials.objects.get(business_id=call.campaign.business_id)
            auth_token = decrypt(credentials.auth_token)
        except TwilioCredentials.DoesNotExist:
            auth_token = None

        # Validate the Twilio callback signature.
        # In production (DEBUG is False), signature validation is strictly enforced.
        signature = request.headers.get('X-Twilio-Signature')
        if not settings.DEBUG:
            if not signature or not auth_token:
                return HttpResponse("Forbidden: Signature Required", status=status.HTTP_403_FORBIDDEN)

        if signature and auth_token:
            absolute_url = request.build_absolute_uri()
            if request.headers.get('X-Forwarded-Proto') == 'https':
                absolute_url = absolute_url.replace('http://', 'https://')
                
            if not verify_twilio_signature(absolute_url, request.POST, auth_token, signature):
                return HttpResponse("Forbidden: Invalid Signature", status=status.HTTP_403_FORBIDDEN)

        # Parse status and parameters sent by Twilio safely
        twilio_status = request.POST.get('CallStatus', '').lower()
        
        # Safely convert CallDuration to integer to prevent crashes on non-numeric input
        raw_duration = request.POST.get('CallDuration', '0')
        try:
            duration_sec = int(raw_duration)
        except ValueError:
            duration_sec = 0

        # Map Twilio call statuses to our internal state options
        # queued -> queued, ringing -> ringing, in-progress -> in_progress,
        # completed -> completed, failed/busy -> failed, no-answer -> no_answer
        status_mapping = {
            'queued': 'queued',
            'ringing': 'ringing',
            'in-progress': 'in_progress',
            'completed': 'completed',
            'failed': 'failed',
            'busy': 'failed',
            'no-answer': 'no_answer'
        }
        
        new_status = status_mapping.get(twilio_status, call.status)
        call.status = new_status
        call.duration_sec = duration_sec

        # Determine if the call was successfully answered
        if twilio_status == 'completed' and duration_sec > 0:
            call.outcome = 'answered'
        elif twilio_status in ['busy', 'failed']:
            call.outcome = 'failed'
        elif twilio_status == 'no-answer':
            call.outcome = 'no_answer'

        call.save()

        # Update parent Campaign stats atomically when a call resolves
        from django.db.models import F
        if new_status in ['completed', 'failed', 'no_answer']:
            campaign = call.campaign
            campaign.calls_completed = F('calls_completed') + 1
            if call.outcome == 'answered':
                campaign.calls_answered = F('calls_answered') + 1
            elif call.outcome in ['failed', 'no_answer']:
                campaign.calls_failed = F('calls_failed') + 1
            campaign.save()

        # Log the state change as a traceable call event in history
        CallEvent.objects.create(
            call=call,
            event_type=f"twilio_{twilio_status}",
            payload={key: request.POST[key] for key in request.POST.keys()}
        )

        return HttpResponse("OK", status=status.HTTP_200_OK)
