import abc
import os
import math
import audioop
import httpx

# Abstract base class that defines the contract for text-to-speech converters.
# This ensures any new voice provider can be plugged in seamlessly.
class TTSAdapter(abc.ABC):
    
    # Synthesizes text into raw G.711 PCMU (u-law) 8kHz mono audio bytes,
    # which is the exact format Twilio expects for real-time WebSocket streaming.
    @abc.abstractmethod
    def synthesize(self, text: str) -> bytes:
        pass


# Synthesizes text using ElevenLabs API and directly requests G.711 mu-law 8kHz audio.
# This avoids doing heavy audio transcoding or resample operations on our server.
class ElevenLabsTTSAdapter(TTSAdapter):
    
    def __init__(self, api_key: str = None, voice_id: str = "21m00Tcm4TlvDq8ikWAM"):
        # Look for the api key in the environment if it wasn't passed directly
        self.api_key = api_key or os.environ.get("ELEVENLABS_API_KEY", "")
        self.voice_id = voice_id
        self.url = f"https://api.elevenlabs.io/v1/text-to-speech/{self.voice_id}/stream"

    # Calls ElevenLabs stream endpoint and fetches the synthetic voice in u-law format.
    def synthesize(self, text: str) -> bytes:
        if not self.api_key:
            raise ValueError("ElevenLabs API Key is missing. Please add ELEVENLABS_API_KEY to your environment variables.")

        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
            "accept": "*/*"
        }
        
        # We request output_format=ulaw_8000 so ElevenLabs does the heavy mu-law conversion for us
        params = {
            "output_format": "ulaw_8000"
        }
        
        payload = {
            "text": text,
            "model_id": "eleven_monolingual_v1",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75
            }
        }

        # Send request to ElevenLabs API and return the raw audio bytes
        with httpx.Client() as client:
            response = client.post(self.url, json=payload, headers=headers, params=params)
            if response.status_code != 200:
                raise Exception(f"ElevenLabs API failed with status {response.status_code}: {response.text}")
            return response.content


# Generates simple synthetic sine-wave tones in G.711 PCMU (u-law) format.
# This lets us run development, offline sandbox work, and unit tests without hitting paid APIs.
class LocalFallbackTTSAdapter(TTSAdapter):
    
    # Creates a 440Hz sine wave tone matching the length of the text,
    # then converts it from 16-bit PCM to 8-bit u-law bytes.
    def synthesize(self, text: str) -> bytes:
        # Estimate the speech duration by assuming a person reads about 15 characters per second
        chars_per_second = 15
        duration_sec = max(1.0, len(text) / chars_per_second)
        
        # G.711 PCMU standard is 8000 samples per second
        sample_rate = 8000
        num_samples = int(duration_sec * sample_rate)
        
        # Build the raw 16-bit PCM linear signal for a standard 440Hz tone
        frequency = 440.0
        pcm_data = b""
        for i in range(num_samples):
            # Generate a sine wave amplitude between -32768 and 32767
            sample_val = int(32767 * math.sin(2 * math.pi * frequency * i / sample_rate))
            # Convert sample to 16-bit signed little endian bytes (width=2)
            pcm_data += sample_val.to_bytes(2, byteorder='little', signed=True)
            
        # Convert the 16-bit signed PCM stream to 8-bit mu-law bytes using python's built-in audioop
        ulaw_data = audioop.lin2ulaw(pcm_data, 2)
        return ulaw_data
