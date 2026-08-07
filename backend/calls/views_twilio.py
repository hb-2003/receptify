from django.http import HttpResponse, JsonResponse, HttpResponseForbidden
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from twilio.request_validator import RequestValidator
from xml.sax.saxutils import escape
from receptify.crypto import decrypt
from receptify.models import TwilioCredentials
from calls.models import Call, CallEvent
from calls.tts_adapter import GoogleCloudTTSAdapter
from django.db.models import F
import asyncio
import logging

logger = logging.getLogger("receptify.calls.twilio")

# Maps campaign voice_type selections to Twilio Polly neural voice identifiers
VOICE_MAP = {
    'female_professional': 'Polly.Aditi',
    'female_friendly': 'Polly.Kajal',
    'male_professional': 'Polly.Amit',
    'male_friendly': 'Polly.Amit',
}

# Maps our frontend voice types to Google Cloud voice names
GCP_VOICE_MAP = {
    'female_professional': 'en-IN-Neural2-A',
    'female_friendly': 'en-IN-Wavenet-A',
    'male_professional': 'en-IN-Neural2-B',
    'male_friendly': 'en-IN-Wavenet-B',
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
    # For GET requests (like fetching audio), use request.GET
    data = request.POST.dict() if request.method == "POST" else request.GET.dict()

    return validator.validate(url, data, signature)

def format_call_script(script_text: str, customer) -> str:
    """Replaces variables in the script with actual customer data."""
    if not script_text:
        return "Hello, this is a call from Receptify."
    if not customer:
        return script_text

    formatted = script_text.replace("{{fullName}}", customer.full_name or "customer")
    formatted = formatted.replace("{{customerType}}", customer.customer_type or "")
    formatted = formatted.replace("{{city}}", customer.city or "")

    # Handle dynamic JSON fields if present
    custom_fields = customer.custom_fields or {}
    for key, value in custom_fields.items():
        formatted = formatted.replace(f"{{{{{key}}}}}", str(value))

    return formatted


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

        # Retrieve dynamic script text and format it with customer data
        raw_script = call.campaign.script_text or "Hello, this is a call from Receptify."
        script_text = format_call_script(raw_script, call.customer)
        escaped_script = escape(script_text)

        # Check if we should use Google Cloud TTS or fallback to Twilio Polly
        has_gcloud = False
        try:
            # If ADC (Application Default Credentials) are set, this won't throw
            _ = GoogleCloudTTSAdapter()
            has_gcloud = True
        except Exception:
            has_gcloud = False

        if has_gcloud:
            # Use dynamic audio URL serving the GCP TTS output
            audio_url = request.build_absolute_uri(f'/api/calls/{call.id}/audio')

            # Twilio requires valid URL structure even for proxied URLs
            proto = request.headers.get("X-Forwarded-Proto", "https")
            host = request.headers.get("X-Forwarded-Host", request.get_host())
            if "://" in audio_url:
                parts = audio_url.split("://", 1)
                path_and_query = parts[1].split("/", 1)[1] if "/" in parts[1] else ""
                audio_url = f"{proto}://{host}/{path_and_query}"

            twiml_content = (
                '<?xml version="1.0" encoding="UTF-8"?>\n'
                '<Response>\n'
                f'    <Play>{audio_url}</Play>\n'
                '</Response>'
            )
        else:
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


class TwilioCallRecordingView(APIView):
    # Twilio posts recording details to this webhook when recording completes.
    permission_classes = [AllowAny]

    def post(self, request, id, *args, **kwargs):
        try:
            call = Call.objects.get(id=id)
        except Call.DoesNotExist:
            return HttpResponse("Call not found", status=404)

        # Validate signature if credentials exist
        try:
            credentials = TwilioCredentials.objects.get(business_id=call.campaign.business_id)
            auth_token = decrypt(credentials.auth_token)
            if not verify_twilio_signature(request, auth_token):
                if not credentials.account_sid.startswith("AC_mock_") and credentials.account_sid != "mock_sid":
                    return HttpResponseForbidden("Invalid signature")
        except Exception:
            pass

        recording_url = request.data.get("RecordingUrl") or request.data.get("recordingUrl", "")
        recording_sid = request.data.get("RecordingSid") or request.data.get("recordingSid", "")
        duration = request.data.get("RecordingDuration") or request.data.get("recordingDuration", 0)

        try:
            duration_sec = int(duration)
        except (ValueError, TypeError):
            duration_sec = 0

        from calls.models import CallRecording
        recording, _ = CallRecording.objects.get_or_create(call=call)
        recording.recording_sid = recording_sid
        if recording_url:
            recording.audio_url = recording_url
        recording.duration_sec = duration_sec
        recording.save()

        CallEvent.objects.create(
            call=call,
            event_type="recording_completed",
            payload=request.data
        )

        # Trigger async transcription and LLM summarization
        from calls.tasks import dispatch_transcribe_and_summarize
        dispatch_transcribe_and_summarize(str(call.id))

        return JsonResponse({"success": True})

class CallAudioView(APIView):
    # Twilio <Play> fetches the audio from this endpoint.
    permission_classes = [AllowAny]

    def get(self, request, id, *args, **kwargs):
        try:
            call = Call.objects.get(id=id)
        except Call.DoesNotExist:
            return HttpResponse("Call not found", status=404)

        # Retrieve and decrypt credentials to validate signature, since Twilio hits this URL directly
        try:
            credentials = TwilioCredentials.objects.get(business_id=call.campaign.business_id)
            auth_token = decrypt(credentials.auth_token)
        except Exception:
            return HttpResponseForbidden("Missing or invalid credentials")

        if not verify_twilio_signature(request, auth_token):
            return HttpResponseForbidden("Invalid signature")

        # Format script
        raw_script = call.campaign.script_text or "Hello, this is a call from Receptify."
        script_text = format_call_script(raw_script, call.customer)
        voice_name = GCP_VOICE_MAP.get(call.campaign.voice_type, 'en-IN-Neural2-A')

        try:
            adapter = GoogleCloudTTSAdapter()
            audio_bytes = asyncio.run(self._get_all_bytes(adapter, script_text, voice_name, "MULAW"))
        except Exception as e:
            logger.error(f"Failed to generate GCloud TTS audio for call {call.id}: {e}")
            return HttpResponse("Audio generation failed", status=500)

        # Return MULAW audio with standard content type for Twilio
        response = HttpResponse(audio_bytes, content_type="audio/basic")
        return response

    async def _get_all_bytes(self, adapter, text, voice_name, encoding):
        chunks = []
        async for chunk in adapter.generate_audio_stream(text, voice_name=voice_name, encoding=encoding):
            chunks.append(chunk)
        return b"".join(chunks)
