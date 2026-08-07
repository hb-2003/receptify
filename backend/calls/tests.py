import jwt
import base64
import hmac
import hashlib
import uuid
import unittest
from django.test import TestCase, override_settings
from django.urls import reverse
from unittest.mock import AsyncMock, patch, MagicMock
from google.cloud import texttospeech
from receptify.models import Business, User, TwilioCredentials
from receptify.crypto import encrypt
from campaigns.models import Campaign
from customers.models import Customer
from calls.models import Call, CallEvent
from calls.tts_adapter import GoogleCloudTTSAdapter, MockFallbackAdapter
from calls.utils_twilio import initiate_twilio_call


class TwilioTwiMLViewTests(TestCase):
    # Tests for the static test TwiML endpoint with signature validation (KAN-21).
    # Verifies that requests without valid businessId and signature are rejected.

    def setUp(self):
        self.business = Business.objects.create(
            name="Test Business",
            plan_tier="starter"
        )
        self.credentials = TwilioCredentials.objects.create(
            business=self.business,
            account_sid="ACmockaccountsid12345",
            auth_token="Uiw0pU/fU8b+YpIsfB7k0U6Nn3Gf3ETo69/9xG9y:auth_tag:encrypted_val",
            phone_number="+1234567890"
        )

    def test_twiml_view_rejects_without_business_id(self):
        url = reverse("twiml_endpoint")
        response = self.client.post(url)
        self.assertEqual(response.status_code, 403)

    @patch("calls.views_twilio.decrypt")
    def test_twiml_view_rejects_invalid_signature(self, mock_decrypt):
        mock_decrypt.return_value = "mock_token_secret_value"
        url = reverse("twiml_endpoint")
        response = self.client.post(
            f"{url}?businessId={self.business.id}",
            HTTP_X_TWILIO_SIGNATURE="fake_invalid_sig_value"
        )
        self.assertEqual(response.status_code, 403)

    @patch("calls.views_twilio.decrypt")
    def test_twiml_view_accepts_valid_signature(self, mock_decrypt):
        mock_decrypt.return_value = "mock_token_secret_value"
        url = reverse("twiml_endpoint")
        full_url = f"http://testserver{url}?businessId={self.business.id}"
        computed = hmac.new(
            b"mock_token_secret_value", full_url.encode("utf-8"), hashlib.sha1
        ).digest()
        valid_signature = base64.b64encode(computed).decode("utf-8")

        with override_settings(DEBUG=False):
            response = self.client.post(
                f"{url}?businessId={self.business.id}",
                HTTP_X_TWILIO_SIGNATURE=valid_signature,
                HTTP_X_FORWARDED_PROTO="http"
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response["Content-Type"], "application/xml")
            self.assertIn("Hello, this is a test from Receptify", response.content.decode("utf-8"))


class TwilioCallWebhookTests(TestCase):
    """
    Unit tests for call-specific Twilio TwiML and Status webhooks with signature security (KAN-18, KAN-19).
    """

    def setUp(self):
        # Create test business, credentials, campaign, customer, and call
        self.business = Business.objects.create(
            name="Test Business",
            plan_tier="starter"
        )
        # Auth token is 'mock_token_secret_value'
        self.credentials = TwilioCredentials.objects.create(
            business=self.business,
            account_sid="ACmockaccountsid12345",
            auth_token="Uiw0pU/fU8b+YpIsfB7k0U6Nn3Gf3ETo69/9xG9y:auth_tag:encrypted_val", # Encrypted
            phone_number="+1234567890"
        )
        self.campaign = Campaign.objects.create(
            business=self.business,
            name="Test Campaign",
            script_text="Welcome Rajesh, please pay your bills.",
            status="draft"
        )
        self.customer = Customer.objects.create(
            business=self.business,
            full_name="Rajesh Kumar",
            phone="+919812345001"
        )
        self.call = Call.objects.create(
            campaign=self.campaign,
            customer=self.customer,
            status="queued"
        )

    @patch("calls.views_twilio.decrypt")
    def test_call_twiml_webhook_fails_with_invalid_signature(self, mock_decrypt):
        # Mock decryption to return the plain text Twilio token
        mock_decrypt.return_value = "mock_token_secret_value"

        url = reverse("call_twiml", kwargs={"id": self.call.id})
        
        # Enforce debug false so mock signature bypass is inactive
        with override_settings(DEBUG=False):
            # Send with invalid/fake signature header
            response = self.client.post(
                url,
                HTTP_X_TWILIO_SIGNATURE="fake_invalid_sig_value"
            )
            # Should be rejected with 403 Forbidden
            self.assertEqual(response.status_code, 403)
            self.assertEqual(response.content.decode("utf-8"), "Invalid signature")

    @patch("calls.views_twilio.decrypt")
    def test_call_twiml_webhook_passes_with_valid_signature(self, mock_decrypt):
        # Mock decryption to return the plain text Twilio token
        mock_decrypt.return_value = "mock_token_secret_value"

        url = reverse("call_twiml", kwargs={"id": self.call.id})
        full_url = f"http://testserver{url}"

        # Calculate exact expected Twilio signature using the decrypted token
        # As it has no POST body elements, signature is calculated on URL only
        computed = hmac.new(
            b"mock_token_secret_value",
            full_url.encode("utf-8"),
            hashlib.sha1
        ).digest()
        valid_signature = base64.b64encode(computed).decode("utf-8")

        with override_settings(DEBUG=False):
            response = self.client.post(
                url,
                HTTP_X_TWILIO_SIGNATURE=valid_signature,
                HTTP_X_FORWARDED_PROTO="http"
            )
            
            # Verify status and headers
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response["Content-Type"], "application/xml")

            # Verify call status updated to in_progress
            self.call.refresh_from_db()
            self.assertEqual(self.call.status, "in_progress")

    @patch("calls.views_twilio.decrypt")
    def test_call_status_completed_webhook_with_valid_signature(self, mock_decrypt):
        mock_decrypt.return_value = "mock_token_secret_value"

        url = reverse("call_status", kwargs={"id": self.call.id})
        full_url = f"http://testserver{url}"

        # POST payload variables
        payload = {
            "CallStatus": "completed",
            "CallDuration": "45"
        }

        # Concat sorted post parameters to URL for signature calculation
        # Sort keys: CallDuration, CallStatus
        concatenated = full_url + "CallDuration45" + "CallStatuscompleted"
        computed = hmac.new(
            b"mock_token_secret_value",
            concatenated.encode("utf-8"),
            hashlib.sha1
        ).digest()
        valid_signature = base64.b64encode(computed).decode("utf-8")

        with override_settings(DEBUG=False):
            response = self.client.post(
                url,
                data=payload,
                HTTP_X_TWILIO_SIGNATURE=valid_signature,
                HTTP_X_FORWARDED_PROTO="http"
            )

            # Verify status code
            self.assertEqual(response.status_code, 200)

            # Verify call record updated
            self.call.refresh_from_db()
            self.assertEqual(self.call.status, "completed")
            self.assertEqual(self.call.outcome, "completed")
            self.assertEqual(self.call.duration_sec, 45)

    @patch("calls.views_twilio.decrypt")
    def test_call_twiml_uses_voice_type_mapping(self, mock_decrypt):
        # Verifies that the campaign's voice_type is mapped to the correct Twilio Polly voice
        mock_decrypt.return_value = "mock_token_secret_value"

        url = reverse("call_twiml", kwargs={"id": self.call.id})
        full_url = f"http://testserver{url}"
        computed = hmac.new(
            b"mock_token_secret_value", full_url.encode("utf-8"), hashlib.sha1
        ).digest()
        valid_signature = base64.b64encode(computed).decode("utf-8")

        with override_settings(DEBUG=False):
            response = self.client.post(
                url,
                HTTP_X_TWILIO_SIGNATURE=valid_signature,
                HTTP_X_FORWARDED_PROTO="http"
            )
            self.assertEqual(response.status_code, 200)
            twiml = response.content.decode("utf-8")
            # Default voice_type is 'female_professional' which maps to Polly.Aditi
            self.assertIn("Polly.Aditi", twiml)

    @patch("calls.views_twilio.decrypt")
    def test_call_twiml_voice_type_male_professional(self, mock_decrypt):
        # Verifies male_professional voice_type maps to Polly.Amit
        mock_decrypt.return_value = "mock_token_secret_value"

        # Update campaign to use male_professional voice
        self.campaign.voice_type = "male_professional"
        self.campaign.save()

        url = reverse("call_twiml", kwargs={"id": self.call.id})
        full_url = f"http://testserver{url}"
        computed = hmac.new(
            b"mock_token_secret_value", full_url.encode("utf-8"), hashlib.sha1
        ).digest()
        valid_signature = base64.b64encode(computed).decode("utf-8")

        with override_settings(DEBUG=False):
            response = self.client.post(
                url,
                HTTP_X_TWILIO_SIGNATURE=valid_signature,
                HTTP_X_FORWARDED_PROTO="http"
            )
            self.assertEqual(response.status_code, 200)
            twiml = response.content.decode("utf-8")
            self.assertIn("Polly.Amit", twiml)
            self.assertNotIn("alice", twiml)


class TwilioOutboundCallerTestCase(TestCase):
    """
    Unit tests for KAN-17 Outbound Dialer Core.
    """
    
    def setUp(self):
        # Create a test business
        self.test_business = Business.objects.create(
            name="Delhi NBFC Hub",
            business_type="Finance",
            city="Delhi",
            preferred_language="en",
            is_verified=True,
            call_credits=1000,
            plan_tier="growth"
        )
        
        # Create user
        self.test_user = User.objects.create(
            email="owner@delhinfbc.in",
            password_hash="hashedpass",
            owner_name="Mehta Ji",
            is_email_verified=True,
            business=self.test_business
        )
        
        # Create encrypted Twilio Credentials (GCM serialized token)
        encrypted_token = encrypt("mock_twilio_auth_token_secret_123")
        
        self.credentials = TwilioCredentials.objects.create(
            business=self.test_business,
            account_sid="ACtestaccountsid1234567890abcdef12",
            auth_token=encrypted_token,
            phone_number="+1234567890"
        )
        
        # Create campaign
        self.campaign = Campaign.objects.create(
            business=self.test_business,
            name="Delhi October Recovery",
            purpose="payment_reminder",
            language="en",
            voice_type="male_professional",
            is_compliance_confirmed=True,
            status="draft"
        )
        
        # Create customer
        self.customer = Customer.objects.create(
            business=self.test_business,
            full_name="Rajiv Gandhi",
            phone="+919812345009",
            city="Delhi",
            language="en",
            consent_status="granted"
        )
        
        # Create Call
        self.call = Call.objects.create(
            campaign=self.campaign,
            customer=self.customer,
            status='queued',
            outcome='pending',
            attempt_number=1,
            duration_sec=0,
            channel_type=1 # Live Twilio
        )

    @patch('httpx.Client.post')
    def test_initiate_twilio_call_success(self, mock_post):
        # Setup mock response for Twilio Calls.json success (201 Created)
        mock_resp = MagicMock()
        mock_resp.status_code = 201
        mock_resp.json.return_value = {
            'sid': 'CAmockcallsid1234567890abcdef1234',
            'status': 'queued',
            'to': '+919812345009',
            'from': '+1234567890'
        }
        mock_post.return_value = mock_resp
        
        # Execute call initiation
        result = initiate_twilio_call(str(self.call.id))
        
        self.assertTrue(result.get('success'))
        self.assertEqual(result.get('sid'), 'CAmockcallsid1234567890abcdef1234')
        
        # Verify call status updated to ringing
        refetched_call = Call.objects.get(id=self.call.id)
        self.assertEqual(refetched_call.status, 'ringing')
        
        # Verify CallEvent was created
        events = CallEvent.objects.filter(call_id=self.call.id)
        self.assertEqual(events.count(), 1)
        self.assertEqual(events.first().event_type, 'initiated')
        self.assertEqual(events.first().payload['sid'], 'CAmockcallsid1234567890abcdef1234')

    @patch('httpx.Client.post')
    def test_initiate_twilio_call_carrier_failure(self, mock_post):
        # Setup mock response for Twilio failure (400 Bad Request)
        mock_resp = MagicMock()
        mock_resp.status_code = 400
        mock_resp.text = '{"code": 21211, "message": "The To number is not a valid phone number."}'
        mock_post.return_value = mock_resp
        
        # Execute call initiation
        result = initiate_twilio_call(str(self.call.id))
        
        self.assertIn('error', result)
        self.assertIn('Twilio API error (400)', result['error'])
        
        # Verify call status remained queued
        refetched_call = Call.objects.get(id=self.call.id)
        self.assertEqual(refetched_call.status, 'queued')
        
        # Verify CallEvent was created with 'failed' state
        events = CallEvent.objects.filter(call_id=self.call.id)
        self.assertEqual(events.count(), 1)
        self.assertEqual(events.first().event_type, 'failed')
        self.assertEqual(events.first().payload['status_code'], 400)

    def test_initiate_call_fails_without_credentials(self):
        # Delete Twilio credentials
        self.credentials.delete()
        
        result = initiate_twilio_call(str(self.call.id))
        self.assertIn('error', result)
        self.assertEqual(result['error'], 'No Twilio credentials configured for this business')
        
        # Verify call remained queued
        refetched_call = Call.objects.get(id=self.call.id)
        self.assertEqual(refetched_call.status, 'queued')


class TTSAdapterTests(unittest.IsolatedAsyncioTestCase):
    """
    Unit tests for the Google Cloud TTS and Mock Fallback Adapters (KAN-16).
    """

    async def test_mock_fallback_adapter_yields_silence(self):
        adapter = MockFallbackAdapter()
        chunks = []
        async for chunk in adapter.generate_audio_stream("hello world"):
            chunks.append(chunk)

        self.assertTrue(len(chunks) > 0)
        full_audio = b"".join(chunks)
        self.assertEqual(len(full_audio), 8000)
        self.assertTrue(all(byte == 0xFF for byte in full_audio))

    @patch("google.cloud.texttospeech.TextToSpeechAsyncClient")
    async def test_google_cloud_tts_adapter_synthesize_call(self, mock_client_class):
        mock_client = AsyncMock()
        mock_client_class.return_value = mock_client

        mock_response = AsyncMock()
        mock_response.audio_content = b"fake-mulaw-audio-bytes"
        mock_client.synthesize_speech.return_value = mock_response

        adapter = GoogleCloudTTSAdapter()
        adapter.client = mock_client

        chunks = []
        async for chunk in adapter.generate_audio_stream("Welcome to Receptify", voice_name="en-IN-Neural2-A"):
            chunks.append(chunk)

        mock_client.synthesize_speech.assert_called_once()
        call_kwargs = mock_client.synthesize_speech.call_args[1]
        self.assertEqual(call_kwargs["input"].text, "Welcome to Receptify")
        self.assertEqual(call_kwargs["voice"].language_code, "en-IN")
        self.assertEqual(call_kwargs["audio_config"].audio_encoding, texttospeech.AudioEncoding.MULAW)

        full_audio = b"".join(chunks)
        self.assertEqual(full_audio, b"fake-mulaw-audio-bytes")


class TwilioCallRecordingWebhookTests(TestCase):
    def setUp(self):
        self.business = Business.objects.create(name="Recording Business", plan_tier="starter")
        self.credentials = TwilioCredentials.objects.create(
            business=self.business,
            account_sid="ACmockaccountsid12345",
            auth_token="Uiw0pU/fU8b+YpIsfB7k0U6Nn3Gf3ETo69/9xG9y:auth_tag:encrypted_val",
            phone_number="+1234567890"
        )
        self.campaign = Campaign.objects.create(
            business=self.business,
            name="Recording Campaign",
            script_text="Hello, thank you for choosing Receptify.",
            status="running"
        )
        self.customer = Customer.objects.create(
            business=self.business,
            full_name="Aarav Sharma",
            phone="+919876543210"
        )
        self.call = Call.objects.create(
            campaign=self.campaign,
            customer=self.customer,
            status="completed",
            outcome="completed"
        )

    @patch("calls.stt_service.transcribe_and_summarize_call")
    def test_call_recording_webhook_creates_recording_and_transcript(self, mock_transcribe):
        url = reverse("call_recording", kwargs={"id": self.call.id})
        payload = {
            "RecordingUrl": "https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE12345.mp3",
            "RecordingSid": "RE12345",
            "RecordingDuration": "30"
        }
        response = self.client.post(url, data=payload)
        self.assertEqual(response.status_code, 200)

        from calls.models import CallRecording
        recording = CallRecording.objects.get(call=self.call)
        self.assertEqual(recording.recording_sid, "RE12345")
        self.assertEqual(recording.audio_url, "https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE12345.mp3")
        self.assertEqual(recording.duration_sec, 30)

        # Verify async transcription was triggered
        mock_transcribe.assert_called_once_with(str(self.call.id))

    def test_transcribe_and_summarize_call_service(self):
        from calls.models import CallRecording, CallTranscript
        from calls.stt_service import transcribe_and_summarize_call

        CallRecording.objects.create(
            call=self.call,
            recording_sid="RE12345",
            audio_url="https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE12345.mp3",
            duration_sec=30
        )

        transcribe_and_summarize_call(str(self.call.id))

        transcript = CallTranscript.objects.get(call=self.call)
        self.assertTrue(len(transcript.text) > 0)
        self.assertIn("Aarav Sharma", transcript.summary)


class TTSPreviewViewTests(TestCase):
    def setUp(self):
        self.business = Business.objects.create(name="TTS Business", plan_tier="starter")
        self.user = User.objects.create(
            email="ttsuser@example.com",
            password_hash="hashedpass",
            owner_name="TTS User",
            business=self.business
        )
        token = jwt.encode(
            {"userId": str(self.user.id), "email": self.user.email},
            "change_me",
            algorithm="HS256"
        )
        self.client.cookies["receptify_token"] = token

    def test_tts_preview_requires_script_text(self):
        url = reverse("tts_preview_no_slash")
        response = self.client.post(url, data={}, content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.content, b"Missing scriptText")

    @patch("calls.views_tts.GoogleCloudTTSAdapter")
    def test_tts_preview_success(self, mock_gcp_adapter_cls):
        mock_adapter = MagicMock()

        async def dummy_gen(text, voice_name="en-IN-Neural2-A", encoding="MP3"):
            yield b"fake_mp3_bytes"

        mock_adapter.generate_audio_stream = dummy_gen
        mock_gcp_adapter_cls.return_value = mock_adapter

        url = reverse("tts_preview_no_slash")
        payload = {
            "scriptText": "Hello, this is a test script for preview.",
            "voiceType": "female_friendly"
        }
        response = self.client.post(url, data=payload, content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "audio/mpeg")
        self.assertEqual(response.content, b"fake_mp3_bytes")

    @patch("calls.views_tts.GoogleCloudTTSAdapter", side_effect=Exception("GCP disabled"))
    def test_tts_preview_fallback_on_gcp_error(self, mock_gcp_adapter_cls):
        url = reverse("tts_preview_no_slash")
        payload = {
            "scriptText": "Hello, this is a test script for fallback preview.",
            "voiceType": "male_professional"
        }
        response = self.client.post(url, data=payload, content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "audio/mpeg")
        self.assertEqual(response.content, b"dummy_mp3_data")


