import json
from unittest.mock import patch, MagicMock
from django.test import TestCase
from receptify.models import Business, User, TwilioCredentials
from campaigns.models import Campaign
from customers.models import Customer
from calls.models import Call, CallEvent
from calls.utils_twilio import initiate_twilio_call

class TwilioOutboundCallerTestCase(TestCase):
    
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
        # We can store a dummy token (under testing, mock decrypt will be patched or we can use our real crypto.py since it has a fallback!)
        from receptify.crypto import encrypt
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
