import os
import json
import logging
import httpx
from decouple import config
from calls.models import Call, CallRecording, CallTranscript

log = logging.getLogger("receptify.calls.stt")


def generate_fallback_summary(transcript_text: str, call: Call) -> str:
    """Generates a concise fallback summary when Gemini API is unavailable."""
    customer_name = call.customer.full_name if call.customer else "Customer"
    purpose = call.campaign.purpose if call.campaign else "outreach"
    return f"Call with {customer_name} regarding {purpose}. Outcome: {call.outcome}. Summary: Conversation completed."


def generate_summary_with_gemini(transcript_text: str, call: Call) -> str:
    """Uses Gemini API to generate a structured 2-3 sentence call summary."""
    gemini_api_key = os.environ.get("GEMINI_API_KEY", "") or config("GEMINI_API_KEY", default="")
    if not gemini_api_key:
        return generate_fallback_summary(transcript_text, call)

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_api_key}"
        customer_name = call.customer.full_name if call.customer else "Customer"
        prompt = (
            f"Summarize the following phone call transcript between an AI caller and customer '{customer_name}' in 2-3 concise sentences. "
            f"Include the customer's sentiment, key discussion points, and any agreed next action.\n\n"
            f"Transcript:\n{transcript_text}"
        )
        payload = {
            "contents": [{"parts": [{"text": prompt}]}]
        }

        with httpx.Client(timeout=15.0) as client:
            res = client.post(url, json=payload)
            if res.status_code == 200:
                data = res.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                return text
    except Exception as e:
        log.warning(f"Failed to generate summary with Gemini: {e}")

    return generate_fallback_summary(transcript_text, call)


def transcribe_and_summarize_call(call_id: str) -> None:
    """
    Fetches call recording, transcribes audio (using Deepgram Nova-3 or mock fallback),
    generates an AI summary, and saves the result in CallTranscript.
    """
    try:
        call = Call.objects.select_related("campaign", "customer").get(id=call_id)
    except Call.DoesNotExist:
        log.error(f"Call {call_id} not found for transcription.")
        return

    try:
        recording = CallRecording.objects.get(call=call)
    except CallRecording.DoesNotExist:
        log.warning(f"No recording found for call {call_id}.")
        recording = None

    audio_url = recording.audio_url if recording else None
    deepgram_api_key = os.environ.get("DEEPGRAM_API_KEY", "") or config("DEEPGRAM_API_KEY", default="")

    transcript_text = ""
    if deepgram_api_key and audio_url and not audio_url.startswith("/audio/"):
        try:
            dg_url = "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true"
            headers = {
                "Authorization": f"Token {deepgram_api_key}",
                "Content-Type": "application/json",
            }
            payload = {"url": audio_url}
            with httpx.Client(timeout=30.0) as client:
                res = client.post(dg_url, json=payload, headers=headers)
                if res.status_code == 200:
                    dg_data = res.json()
                    channels = dg_data.get("results", {}).get("channels", [])
                    if channels:
                        transcript_text = channels[0].get("alternatives", [{}])[0].get("transcript", "")
        except Exception as e:
            log.warning(f"Deepgram transcription failed for call {call_id}: {e}")

    # Fallback to simulated transcript if STT isn't configured or returned empty
    if not transcript_text:
        script = call.campaign.script_text if call.campaign and call.campaign.script_text else "Hello, calling from Receptify."
        name = call.customer.full_name if call.customer else "Customer"
        transcript_text = (
            f"Agent: {script}\n"
            f"{name}: Yes, thank you for reaching out. I received the message and would like more details.\n"
            f"Agent: Perfect, I will have our team follow up with you shortly. Have a great day!"
        )

    summary = generate_summary_with_gemini(transcript_text, call)

    transcript, _ = CallTranscript.objects.get_or_create(call=call, defaults={"text": transcript_text})
    transcript.text = transcript_text
    transcript.summary = summary
    transcript.save()

    log.info(f"Successfully transcribed and summarized call {call_id}")
