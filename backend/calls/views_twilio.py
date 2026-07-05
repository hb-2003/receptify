from django.http import HttpResponse, JsonResponse, HttpResponseForbidden
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from twilio.request_validator import RequestValidator
from xml.sax.saxutils import escape
from receptify.crypto import decrypt
from receptify.models import TwilioCredentials
from calls.models import Call, CallEvent


def verify_twilio_signature(request, auth_token):
    """
    Validates Twilio webhook signatures using Twilio SDK RequestValidator.
    Uses decrypted Auth Token as key and parses Nginx proxy headers.
    """
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
    """
    Public webhook that Twilio calls when an outbound phone call is answered.
    Responds with static TwiML (XML) instructing Twilio to Say a test message.
    """
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

        twiml_content = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<Response>\n'
            f'    <Say voice="alice">{escaped_script}</Say>\n'
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

        if call_status in status_mapping:
            call.status = status_mapping[call_status]

        if call_duration:
            try:
                call.duration_sec = int(call_duration)
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

        # Log transition event
        CallEvent.objects.create(
            call=call,
            event_type=f"twilio_{call_status}",
            payload=request.data
        )

        return JsonResponse({"success": True})
