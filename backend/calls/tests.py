import unittest
from django.test import TestCase
from django.urls import reverse
from unittest.mock import AsyncMock, patch
from google.cloud import texttospeech
from receptify.models import Business, TwilioCredentials
from receptify.crypto import encrypt
from campaigns.models import Campaign
from customers.models import Customer
from calls.models import Call, CallEvent
from calls.tts_adapter import GoogleCloudTTSAdapter, MockFallbackAdapter


class TwilioTwiMLViewTests(TestCase):
    """
    Unit tests for the Twilio TwiML Webhook endpoint (KAN-21).
    Verifies public access, XML content type, and TwiML structure.
    """

    def test_twiml_endpoint_returns_static_xml_response(self):
        url = reverse("twiml_endpoint")
        # Send a POST request to the public endpoint (unauthenticated)
        response = self.client.post(url)

        # Verify status code is 200 OK
        self.assertEqual(response.status_code, 200)

        # Verify response content type is application/xml
        self.assertEqual(response["Content-Type"], "application/xml")

        # Parse and verify the XML body contents
        xml_content = response.content.decode("utf-8")
        self.assertIn('<?xml version="1.0" encoding="UTF-8"?>', xml_content)
        self.assertIn("<Response>", xml_content)
        self.assertIn('<Say voice="alice">Hello, this is a test from Receptify.</Say>', xml_content)
        self.assertIn("</Response>", xml_content)


class TwilioCallWebhookTests(TestCase):
    """
    Unit tests for call-specific Twilio TwiML and Status webhooks (KAN-18).
    """

    def setUp(self):
        # Create test business, campaign, customer, and call
        self.business = Business.objects.create(
            name="Test Business",
            plan_tier="starter"
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
        # Seed mock Twilio credentials with encrypted token
        TwilioCredentials.objects.create(
            business=self.business,
            account_sid="AC_test_account_sid_99999",
            auth_token=encrypt("fake_auth_token_for_signature_verification"),
            phone_number="+1234567890"
        )

    @patch("calls.views_twilio.verify_twilio_signature", return_value=True)
    def test_dynamic_call_twiml_webhook(self, mock_verify):
        url = reverse("call_twiml", kwargs={"id": self.call.id})
        response = self.client.post(url)

        # Verify status and headers
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/xml")

        # Verify signature validator was called
        mock_verify.assert_called_once()

        # Verify call status updated to in_progress
        self.call.refresh_from_db()
        self.assertEqual(self.call.status, "in_progress")

        # Verify CallEvent was logged
        self.assertTrue(CallEvent.objects.filter(call=self.call, event_type="answered").exists())

        # Verify XML script content
        xml_content = response.content.decode("utf-8")
        self.assertIn("<Response>", xml_content)
        self.assertIn('<Say voice="alice">Welcome Rajesh, please pay your bills.</Say>', xml_content)

    @patch("calls.views_twilio.verify_twilio_signature", return_value=True)
    def test_call_status_completed_webhook(self, mock_verify):
        url = reverse("call_status", kwargs={"id": self.call.id})
        payload = {
            "CallStatus": "completed",
            "CallDuration": "45"
        }
        response = self.client.post(url, data=payload)

        # Verify status code
        self.assertEqual(response.status_code, 200)

        # Verify signature validator was called
        mock_verify.assert_called_once()

        # Verify call record updated
        self.call.refresh_from_db()
        self.assertEqual(self.call.status, "completed")
        self.assertEqual(self.call.outcome, "completed")
        self.assertEqual(self.call.duration_sec, 45)

        # Verify event was logged
        self.assertTrue(CallEvent.objects.filter(call=self.call, event_type="twilio_completed").exists())

    @patch("calls.views_twilio.verify_twilio_signature", return_value=True)
    def test_call_status_busy_webhook(self, mock_verify):
        url = reverse("call_status", kwargs={"id": self.call.id})
        payload = {
            "CallStatus": "busy"
        }
        response = self.client.post(url, data=payload)

        self.assertEqual(response.status_code, 200)

        # Verify signature validator was called
        mock_verify.assert_called_once()

        self.call.refresh_from_db()
        self.assertEqual(self.call.status, "failed")
        self.assertEqual(self.call.outcome, "busy")


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
