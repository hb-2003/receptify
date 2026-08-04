from django.http import HttpResponse, JsonResponse, HttpResponseForbidden
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from twilio.request_validator import RequestValidator
from xml.sax.saxutils import escape
from receptify.crypto import decrypt
from receptify.models import TwilioCredentials
from calls.models import Call, CallEvent
from django.db.models import F

# Maps campaign voice_type selections to Twilio Polly neural voice identifiers
VOICE_MAP = {
    'female_professional': 'Polly.Aditi',
    'female_friendly': 'Polly.Kajal',
    'male_professional': 'Polly.Amit',
    'male_friendly': 'Polly.Amit',
}


def verify_twilio_signature(request, auth_token):
    # Validates Twilio webhook signatures using Twilio SDK RequestValidator.
    # Uses decrypted Auth Token as key and parses Nginx proxy headers.
    signature = request.headers.get("X-Twilio-Signature")
    if not signature:
        return False

    validator = RequestValidator(auth_token)

    # Reconstruct absolute URL to match Twilio's viewpoint, taking proxy headers into account
    url = request.build_absolute_uri()
    proto = request.headers.get("X-Forwarded-Proto", "https")
    host = request.headers.get("X-Forwarded-Host", request.get_host())
    if "://" in url:
        parts = url.split("://", 1)
        path_and_query = parts[1].split("/", 1)[1] if "/" in parts[1] else ""
        url = f"{proto}://{host}/{path_and_query}"

    # Twilio webhook requests utilize application/x-www-form-urlencoded, populated in request.POST
    data = request.POST.dict()

    return validator.validate(url, data, signature)


class TwilioTwiMLView(APIView):
    # Static test TwiML endpoint for manual testing outside of a campaign context.
    # Requires a valid Twilio signature to prevent abuse.
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        business_id = request.query_params.get('businessId') or request.data.get('businessId')
        if not business_id:
            return HttpResponseForbidden("Missing businessId parameter")

        try:
            credentials = TwilioCredentials.objects.get(business_id=business_id)
            auth_token = decrypt(credentials.auth_token)
        except Exception:
            return HttpResponseForbidden("Missing or invalid credentials")

        if not verify_twilio_signature(request, auth_token):
            return HttpResponseForbidden("Invalid signature")

        twiml_content = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<Response>\n'
            '    <Say voice="alice">Hello, this is a test from Receptify.</Say>\n'
            '</Response>'
        )
        return HttpResponse(twiml_content, content_type="application/xml")


class TwilioCallTwiMLView(APIView):
    # When a customer answers the phone, Twilio hits this endpoint.
    # We tell Twilio what to say by returning the campaign script as voice instructions.
    permission_classes = [AllowAny]

    def post(self, request, id, *args, **kwargs):
        try:
            call = Call.objects.get(id=id)
        except Call.DoesNotExist:
            return HttpResponse('<Response><Hangup/></Response>', content_type="application/xml")

        # Fetch and decrypt credentials to validate signature
        try:
            credentials = TwilioCredentials.objects.get(business_id=call.campaign.business_id)
            auth_token = decrypt(credentials.auth_token)
        except Exception:
            return HttpResponseForbidden("Missing or invalid credentials")

        # Verify Twilio request signature
        if not verify_twilio_signature(request, auth_token):
            return HttpResponseForbidden("Invalid signature")

        # Update status to in_progress upon being answered
        call.status = "in_progress"
        call.save()

        # Log answer event
        CallEvent.objects.create(
            call=call,
            event_type="answered",
            payload=request.data
        )

        # Retrieve dynamic script text and escape it to defend against XML injection
        script_text = call.campaign.script_text or "Hello, this is a call from Receptify."
        escaped_script = escape(script_text)

        # Map campaign voice_type to a Twilio Polly voice, falling back to alice
        voice_id = VOICE_MAP.get(call.campaign.voice_type, 'alice')

        twiml_content = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<Response>\n'
            f'    <Say voice="{voice_id}">{escaped_script}</Say>\n'
            '</Response>'
        )
        return HttpResponse(twiml_content, content_type="application/xml")


class TwilioCallStatusView(APIView):
    # Twilio sends us updates every time a call changes state (ringing, answered, hung up, failed).
    # We record the duration and outcome here.
    permission_classes = [AllowAny]

    def post(self, request, id, *args, **kwargs):
        try:
            call = Call.objects.get(id=id)
        except Call.DoesNotExist:
            return HttpResponse("Call not found", status=404)

        old_status = call.status

        # Fetch and decrypt credentials to validate signature
        try:
            credentials = TwilioCredentials.objects.get(business_id=call.campaign.business_id)
            auth_token = decrypt(credentials.auth_token)
        except Exception:
            return HttpResponseForbidden("Missing or invalid credentials")

        # Verify Twilio request signature
        if not verify_twilio_signature(request, auth_token):
            return HttpResponseForbidden("Invalid signature")

        # Parse url-encoded Twilio status callback parameters
        call_status = request.data.get("CallStatus", "").lower()
        call_duration = request.data.get("CallDuration")

        # Map Twilio call statuses to Receptify DB statuses
        status_mapping = {
            "queued": "queued",
            "ringing": "ringing",
            "in-progress": "in_progress",
            "completed": "completed",
            "busy": "failed",
            "failed": "failed",
            "no-answer": "failed",
            "canceled": "failed"
        }

        new_status = call.status
        if call_status in status_mapping:
            new_status = status_mapping[call_status]
            call.status = new_status

        # Safely convert CallDuration to integer to prevent crashes on non-numeric input
        duration_sec = 0
        if call_duration:
            try:
                duration_sec = int(call_duration)
                call.duration_sec = duration_sec
            except ValueError:
                pass

        # Evaluate outcome metrics
        if call_status == "completed":
            call.outcome = "completed"
        elif call_status == "busy":
            call.outcome = "busy"
        elif call_status == "no-answer":
            call.outcome = "no_answer"
        elif call_status == "failed":
            call.outcome = "failed"
        elif call_status == "canceled":
            call.outcome = "canceled"

        call.save()

        # Update parent Campaign stats atomically when a call resolves for the first time
        if old_status not in ["completed", "failed"] and new_status in ["completed", "failed"]:
            campaign = call.campaign
            campaign.calls_completed = F("calls_completed") + 1
            if call_status == "completed":
                campaign.calls_answered = F("calls_answered") + 1
            else:
                campaign.calls_failed = F("calls_failed") + 1
            campaign.save()

        # Log transition event
        CallEvent.objects.create(
            call=call,
            event_type=f"twilio_{call_status}",
            payload=request.data
        )

        return JsonResponse({"success": True})
