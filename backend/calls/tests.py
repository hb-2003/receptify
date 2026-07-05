import uuid
import hmac
import hashlib
import base64
from django.urls import reverse
from django.test import SimpleTestCase
from rest_framework.test import APITestCase
from rest_framework import status
from unittest.mock import patch, MagicMock
from calls.tts_adapter import LocalFallbackTTSAdapter, ElevenLabsTTSAdapter
from calls.models import Call, CallEvent
from receptify.models import Business, TwilioCredentials
from campaigns.models import Campaign
from customers.models import Customer


# Simple test case for our custom Text-to-Speech (TTS) integration logic
class TTSTestCase(SimpleTestCase):
    
    # Verify that our local fallback generator produces real G.711 PCMU (u-law) bytes
    def test_local_fallback_generates_correct_ulaw_format(self):
        adapter = LocalFallbackTTSAdapter()
        test_text = "Please pay your outstanding balance of one thousand rupees."
        
        # Synthesize audio bytes
        audio_bytes = adapter.synthesize(test_text)
        
        # Ensure we actually get a non-empty byte stream back
        self.assertIsInstance(audio_bytes, bytes)
        self.assertTrue(len(audio_bytes) > 0)
        
        # Standard u-law at 8kHz means 8000 bytes per second.
        # Since our text length is around 60 characters and we assume 15 chars/sec,
        # the estimated duration should be around 4 seconds, so we expect roughly 32,000 bytes.
        self.assertGreater(len(audio_bytes), 8000)

    # Verify that ElevenLabs adapter triggers the correct HTTP endpoints and payloads
    @patch('httpx.Client.post')
    def test_elevenlabs_adapter_sends_correct_payload(self, mock_post):
        # Set up a mock HTTP response from ElevenLabs
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"mock-synthetic-ulaw-audio-bytes"
        mock_post.return_value = mock_response
        
        # Instantiate the ElevenLabs adapter with a mock api key
        adapter = ElevenLabsTTSAdapter(api_key="mock-api-key-12345", voice_id="test-voice-abc")
        
        test_text = "Hello Rajesh, this is an automated call from your clinic."
        audio_bytes = adapter.synthesize(test_text)
        
        # Ensure we received the mock response bytes back
        self.assertEqual(audio_bytes, b"mock-synthetic-ulaw-audio-bytes")
        
        # Check that post was called once with the correct voice endpoint and parameters
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        
        # Verify the requested URL, query parameter, headers, and payload structure
        url = args[0]
        self.assertEqual(url, "https://api.elevenlabs.io/v1/text-to-speech/test-voice-abc/stream")
        self.assertEqual(kwargs['params'], {"output_format": "ulaw_8000"})
        self.assertEqual(kwargs['headers']['xi-api-key'], "mock-api-key-12345")
        self.assertEqual(kwargs['json']['text'], test_text)


# Database integrations test case for our public Twilio Webhook and Status Callback views
class CallWebhookTestCase(APITestCase):

    def setUp(self):
        # Create a test business
        self.business = Business.objects.create(
            name="Mumbai Medicals",
            business_type="Clinic",
            city="Mumbai",
            preferred_language="en",
            is_verified=True,
            call_credits=100,
            plan_tier="starter"
        )
        
        # Create a campaign
        self.campaign = Campaign.objects.create(
            business_id=self.business.id,
            name="Flu Vaccinations",
            purpose="appointment_reminder",
            language="en",
            voice_type="female_professional",
            is_compliance_confirmed=True,
            status="draft"
        )
        
        # Create a customer
        self.customer = Customer.objects.create(
            business_id=self.business.id,
            full_name="Arjun Mehta",
            phone="+919876543222",
            city="Mumbai",
            language="en",
            consent_status="granted"
        )
        
        # Create a Call log record
        self.call = Call.objects.create(
            campaign_id=self.campaign.id,
            customer_id=self.customer.id,
            status="queued",
            outcome="pending",
            duration_sec=0,
            channel_type=1 # Live Twilio
        )
        
        # Store encrypted credentials for signature validation
        # Plain token: "secret_twilio_auth_token_xyz"
        from receptify.crypto import encrypt
        self.raw_token = "secret_twilio_auth_token_xyz"
        self.credentials = TwilioCredentials.objects.create(
            business=self.business,
            account_sid="AC_mock_sid_for_tests",
            auth_token=encrypt(self.raw_token),
            phone_number="+1234567890"
        )
        
        self.twiml_url = reverse('twilio_twiml_with_id', kwargs={'call_id': self.call.id})
        self.status_url = reverse('twilio_status_with_id', kwargs={'call_id': self.call.id})

    # Case A: Retrieving TwiML with valid signature should succeed and log a fetched event
    def test_twiml_view_with_valid_signature_returns_xml(self):
        # Compute a valid Twilio Signature manually
        # Endpoint absolute URL used by rest_framework test client is 'http://testserver' + self.twiml_url
        full_url = "http://testserver" + self.twiml_url
        post_data = {} # Empty POST body
        
        # Calculate expected signature
        data_to_sign = full_url
        signature = base64.b64encode(
            hmac.new(self.raw_token.encode('utf-8'), data_to_sign.encode('utf-8'), hashlib.sha1).digest()
        ).decode('utf-8')
        
        # Make the request with the Twilio signature header
        response = self.client.post(self.twiml_url, data=post_data, HTTP_X_TWILIO_SIGNATURE=signature)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'application/xml')
        self.assertIn(b"alice", response.content)
        self.assertIn(b"Hello, this is a test from Receptify.", response.content)
        
        # Check that a CallEvent is logged
        events = CallEvent.objects.filter(call_id=self.call.id, event_type="twiml_fetched")
        self.assertEqual(events.count(), 1)

    # Case B: Retrieving TwiML with an invalid signature should return 403 Forbidden
    def test_twiml_view_fails_with_invalid_signature(self):
        response = self.client.post(self.twiml_url, HTTP_X_TWILIO_SIGNATURE="fake-signature-abc")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # Case C: Twilio Status callback updates call record and logs status change event
    def test_status_callback_updates_call_record(self):
        payload = {
            'CallStatus': 'completed',
            'CallDuration': '25'
        }
        
        full_url = "http://testserver" + self.status_url
        # Concatenate sorted key-values to URL to sign
        data_to_sign = full_url + "CallDuration25CallStatuscompleted"
        signature = base64.b64encode(
            hmac.new(self.raw_token.encode('utf-8'), data_to_sign.encode('utf-8'), hashlib.sha1).digest()
        ).decode('utf-8')
        
        response = self.client.post(self.status_url, data=payload, HTTP_X_TWILIO_SIGNATURE=signature)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Refresh from database and assert state mutations
        self.call.refresh_from_db()
        self.assertEqual(self.call.status, 'completed')
        self.assertEqual(self.call.duration_sec, 25)
        self.assertEqual(self.call.outcome, 'answered')
        
        # Verify a call event is logged
        events = CallEvent.objects.filter(call_id=self.call.id, event_type="twilio_completed")
        self.assertEqual(events.count(), 1)
        self.assertEqual(events.first().payload['CallDuration'], '25')
