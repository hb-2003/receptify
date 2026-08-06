import asyncio
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from calls.tts_adapter import GoogleCloudTTSAdapter, MockFallbackAdapter
import logging

logger = logging.getLogger("receptify.calls.tts")

# Map our frontend voice types to Google Cloud voice names
GCP_VOICE_MAP = {
    'female_professional': 'en-IN-Neural2-A',
    'female_friendly': 'en-IN-Wavenet-A',
    'male_professional': 'en-IN-Neural2-B',
    'male_friendly': 'en-IN-Wavenet-B',
}

class TTSPreviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        script_text = request.data.get('scriptText', '').strip()
        voice_type = request.data.get('voiceType', 'female_professional')

        if not script_text:
            return HttpResponse(status=status.HTTP_400_BAD_REQUEST, content=b"Missing scriptText")

        voice_name = GCP_VOICE_MAP.get(voice_type, 'en-IN-Neural2-A')

        try:
            # Try Google Cloud TTS
            adapter = GoogleCloudTTSAdapter()
            audio_bytes = asyncio.run(self._get_all_bytes(adapter, script_text, voice_name, "MP3"))
        except Exception as e:
            logger.warning(f"GCP TTS failed or not configured, using fallback. Error: {e}")
            adapter = MockFallbackAdapter()
            audio_bytes = asyncio.run(self._get_all_bytes(adapter, script_text, voice_name, "MP3"))

        response = HttpResponse(audio_bytes, content_type="audio/mpeg")
        return response

    async def _get_all_bytes(self, adapter, text, voice_name, encoding):
        chunks = []
        async for chunk in adapter.generate_audio_stream(text, voice_name=voice_name, encoding=encoding):
            chunks.append(chunk)
        return b"".join(chunks)
