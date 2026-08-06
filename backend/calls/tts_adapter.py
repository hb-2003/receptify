from abc import ABC, abstractmethod
from typing import AsyncGenerator
from google.cloud import texttospeech


class BaseTTSAdapter(ABC):
    """
    Abstract Base Class for Text-to-Speech adapters.
    Provides a unified asynchronous interface to stream audio.
    """
    @abstractmethod
    async def generate_audio_stream(self, text: str, voice_name: str = "en-IN-Neural2-A", encoding: str = "MULAW") -> AsyncGenerator[bytes, None]:
        """
        Synthesizes the input text into an audio byte stream.

        Args:
            text: The plain text to synthesize.
            voice_name: The GCP TTS voice model identifier (e.g. 'en-IN-Neural2-A').
            encoding: 'MULAW' (for telephony) or 'MP3' (for browser preview).

        Returns:
            An AsyncGenerator yielding raw audio bytes in chunks.
        """
        pass


class GoogleCloudTTSAdapter(BaseTTSAdapter):
    """
    Google Cloud Text-to-Speech Adapter.
    Natively requests MULAW (G.711 PCMU) 8kHz audio streams for low-latency Twilio calling,
    or MP3 for preview generation.
    """
    def __init__(self):
        # TextToSpeechAsyncClient handles gRPC calls asynchronously under the hood.
        self.client = texttospeech.TextToSpeechAsyncClient()

    async def generate_audio_stream(self, text: str, voice_name: str = "en-IN-Neural2-A", encoding: str = "MULAW") -> AsyncGenerator[bytes, None]:
        # Extract language code from voice_name (e.g., "en-IN-Neural2-A" -> "en-IN")
        parts = voice_name.split("-")
        lang_code = "-".join(parts[:2]) if len(parts) >= 2 else "en-IN"

        synthesis_input = texttospeech.SynthesisInput(text=text)

        voice = texttospeech.VoiceSelectionParams(
            language_code=lang_code,
            name=voice_name
        )

        audio_encoding_enum = texttospeech.AudioEncoding.MULAW
        sample_rate = 8000
        if encoding == "MP3":
            audio_encoding_enum = texttospeech.AudioEncoding.MP3
            sample_rate = 24000 # Higher sample rate for preview

        audio_config = texttospeech.AudioConfig(
            audio_encoding=audio_encoding_enum,
            sample_rate_hertz=sample_rate
        )

        # Execute async RPC call to Google TTS
        response = await self.client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config
        )

        # Chunk the output audio bytes to stream to our WebSocket loop
        chunk_size = 1024
        audio_data = response.audio_content
        for i in range(0, len(audio_data), chunk_size):
            yield audio_data[i:i + chunk_size]


class MockFallbackAdapter(BaseTTSAdapter):
    """
    Offline/Local Fallback TTS Adapter.
    Bypasses external APIs to yield dummy audio bytes.
    Ensures testing and offline development can execute without incurring any API fees.
    """
    async def generate_audio_stream(self, text: str, voice_name: str = "en-IN-Neural2-A", encoding: str = "MULAW") -> AsyncGenerator[bytes, None]:
        if encoding == "MP3":
            # Just yield some dummy data, won't be a valid MP3 but enough to return a response
            yield b"dummy_mp3_data"
            return

        # G.711 PCMU u-law silence is represented by 0xFF.
        # At 8000Hz, 1 second of audio consists of 8000 samples (8000 bytes).
        silence_byte = b"\xFF"
        total_samples = 8000
        chunk_size = 1024

        for i in range(0, total_samples, chunk_size):
            size = min(chunk_size, total_samples - i)
            yield silence_byte * size
