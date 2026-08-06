import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'receptify.settings')
django.setup()

from calls.tts_adapter import GoogleCloudTTSAdapter
try:
    adapter = GoogleCloudTTSAdapter()
    print("Success init")
except Exception as e:
    print(f"Error init: {type(e).__name__} - {e}")
