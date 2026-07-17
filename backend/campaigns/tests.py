import uuid
import time as real_time
from unittest.mock import patch
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITransactionTestCase
from receptify.models import Business, TwilioCredentials, User
from receptify.crypto import encrypt
from campaigns.models import Campaign, CampaignCustomer
from customers.models import Customer
from calls.models import Call, CallEvent

# Tests the campaign launching and queueing validations for KAN-17
class CampaignLaunchRoutingTestCase(APITransactionTestCase):
    
    def setUp(self):
        # Create a test business profile
        self.test_business = Business.objects.create(
            name="Test clinic",
            business_type="Clinic",
            city="Delhi",
            preferred_language="en",
            is_verified=True,
            call_credits=500,
            plan_tier="growth"
        )
        
        # Create an owner account for our tests and log them in
        self.test_user = User.objects.create(
            email="test@clinic.in",
            password_hash="SecurePasswordHash",
            owner_name="Dr. Vikram",
            phone="+919876543210",
            role="owner",
            is_email_verified=True,
            business_id=self.test_business.id
        )
        self.client.force_authenticate(user=self.test_user)
        
        # Create a draft campaign
        self.test_campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="EMI Reminder October",
            purpose="payment_reminder",
            language="en",
            voice_type="female_professional",
            is_compliance_confirmed=True,
            status="draft"
        )
        
        # Create a customer profile
        self.test_customer = Customer.objects.create(
            business_id=self.test_business.id,
            full_name="Rajesh Kumar",
            phone="+919812345001",
            city="Delhi",
            language="en",
            consent_status="granted"
        )
        
        # Define the launch endpoint url
        self.launch_url = reverse('campaign_launch', kwargs={'id': self.test_campaign.id})

    # Case A: Launching should fail if there are no Twilio credentials configured
    def test_launch_fails_without_twilio_credentials(self):
        # First associate a contact to avoid empty campaign failure
        CampaignCustomer.objects.create(
            campaign=self.test_campaign,
            customer_id=self.test_customer.id
        )
        
        response = self.client.post(self.launch_url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("No Twilio credentials configured", response.data['error'])

    # Case B: Launching should fail if the campaign has zero contacts
    def test_launch_fails_with_no_contacts(self):
        # Set up Twilio credentials first so we pass that validation
        TwilioCredentials.objects.create(
            business=self.test_business,
            account_sid="AC_mock_twilio_account_sid_99999",
            auth_token="encryptedtokensecret",
            phone_number="+1234567890"
        )
        
        response = self.client.post(self.launch_url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("no contacts", response.data['error'])

    # Case C: Launching should fail if the campaign is already scheduled or running (not in draft)
    def test_launch_fails_if_campaign_is_not_draft(self):
        # Set up Twilio credentials and associate a contact
        TwilioCredentials.objects.create(
            business=self.test_business,
            account_sid="AC_mock_twilio_account_sid_99999",
            auth_token="encryptedtokensecret",
            phone_number="+1234567890"
        )
        CampaignCustomer.objects.create(
            campaign=self.test_campaign,
            customer_id=self.test_customer.id
        )
        
        # Change campaign status to scheduled
        self.test_campaign.status = "scheduled"
        self.test_campaign.save()
        
        response = self.client.post(self.launch_url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Only draft campaigns can be launched", response.data['error'])

    # Case D: Successful launch transitions status and bulk-creates queued calls
    def test_successful_launch_queues_live_calls(self):
        # Create Twilio credentials and associate contact
        TwilioCredentials.objects.create(
            business=self.test_business,
            account_sid="AC_mock_twilio_account_sid_99999",
            auth_token="encryptedtokensecret",
            phone_number="+1234567890"
        )
        CampaignCustomer.objects.create(
            campaign=self.test_campaign,
            customer_id=self.test_customer.id
        )
        
        response = self.client.post(self.launch_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify response structure and camelCase status
        self.assertEqual(response.data['campaign']['status'], 'scheduled')
        
        # Verify database fields have updated correctly
        campaign = Campaign.objects.get(id=self.test_campaign.id)
        self.assertEqual(campaign.status, 'scheduled')
        self.assertEqual(campaign.channel_type, 1) # Live Twilio
        
        # Verify a Call record has been created for our customer with correct defaults
        calls_list = Call.objects.filter(campaign_id=self.test_campaign.id)
        self.assertEqual(calls_list.count(), 1)
        
        queued_call = calls_list.first()
        self.assertEqual(queued_call.customer_id, self.test_customer.id)
        self.assertEqual(queued_call.status, "queued")
        self.assertEqual(queued_call.channel_type, 1) # Live Twilio channel

    # Case E: Successful launch executes the background dialer thread, transitions status to completed, and dispatches calls
    @patch('time.sleep', return_value=None)
    def test_launch_runs_dialer_and_completes_campaign(self, mock_sleep):
        # Set up Twilio credentials with properly encrypted auth token
        TwilioCredentials.objects.create(
            business=self.test_business,
            account_sid="AC_mock_twilio_account_sid_99999",
            auth_token=encrypt("raw_secret_twilio_auth_token"),
            phone_number="+1234567890"
        )
        CampaignCustomer.objects.create(
            campaign=self.test_campaign,
            customer_id=self.test_customer.id
        )
        
        # Patch is_trai_compliant_time to True to ensure the dialer runs
        with patch('campaigns.dialer.is_trai_compliant_time', return_value=True):
            response = self.client.post(self.launch_url)
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            
            # Since the background thread runs concurrently, we wait for it to complete
            timeout = 2.0
            start_time = real_time.time()
            while real_time.time() - start_time < timeout:
                campaign = Campaign.objects.get(id=self.test_campaign.id)
                if campaign.status == 'completed':
                    break
                real_time.sleep(0.05)
                
            campaign = Campaign.objects.get(id=self.test_campaign.id)
            self.assertEqual(campaign.status, 'completed')
            
            # Check call has transitioned to ringing (indicating successful mock dispatch)
            queued_call = Call.objects.filter(campaign_id=self.test_campaign.id).first()
            self.assertEqual(queued_call.status, 'ringing')
            
            # Check call event is recorded
            self.assertTrue(CallEvent.objects.filter(call=queued_call, event_type="outbound_initiated_mock").exists())

    # Case F: Dialer halts and defers campaign if launched outside TRAI compliance window
    @patch('time.sleep', return_value=None)
    def test_launch_defers_campaign_outside_trai_hours(self, mock_sleep):
        # Set up Twilio credentials with properly encrypted auth token
        TwilioCredentials.objects.create(
            business=self.test_business,
            account_sid="AC_mock_twilio_account_sid_99999",
            auth_token=encrypt("raw_secret_twilio_auth_token"),
            phone_number="+1234567890"
        )
        CampaignCustomer.objects.create(
            campaign=self.test_campaign,
            customer_id=self.test_customer.id
        )
        
        # Force the TRAI compliance check to return False (non-compliant hours)
        with patch('campaigns.dialer.is_trai_compliant_time', return_value=False):
            response = self.client.post(self.launch_url)
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            
            # Wait for thread execution to exit
            real_time.sleep(0.2)
            
            # Campaign status should have stayed 'scheduled' (execution deferred)
            campaign = Campaign.objects.get(id=self.test_campaign.id)
            self.assertEqual(campaign.status, 'scheduled')
            
            # Call should have stayed 'queued'
            queued_call = Call.objects.filter(campaign_id=self.test_campaign.id).first()
            self.assertEqual(queued_call.status, 'queued')

    # Case G: Dialer scrubs and blocks phone numbers listed on the DND registry
    @patch('time.sleep', return_value=None)
    def test_launch_scrubs_and_blocks_dnd_numbers(self, mock_sleep):
        # Set up Twilio credentials with properly encrypted auth token
        TwilioCredentials.objects.create(
            business=self.test_business,
            account_sid="AC_mock_twilio_account_sid_99999",
            auth_token=encrypt("raw_secret_twilio_auth_token"),
            phone_number="+1234567890"
        )
        
        # Create a customer with a DND number (ending in "00")
        dnd_customer = Customer.objects.create(
            business_id=self.test_business.id,
            full_name="DND User",
            phone="+919876543000",
            city="Delhi",
            language="en",
            consent_status="granted"
        )
        CampaignCustomer.objects.create(
            campaign=self.test_campaign,
            customer_id=dnd_customer.id
        )
        
        with patch('campaigns.dialer.is_trai_compliant_time', return_value=True):
            response = self.client.post(self.launch_url)
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            
            # Wait for campaign status to be completed
            timeout = 2.0
            start_time = real_time.time()
            while real_time.time() - start_time < timeout:
                campaign = Campaign.objects.get(id=self.test_campaign.id)
                if campaign.status == 'completed':
                    break
                real_time.sleep(0.05)
            
            # Campaign should finish processing
            campaign = Campaign.objects.get(id=self.test_campaign.id)
            self.assertEqual(campaign.status, 'completed')
            
            # Call should have been marked as failed and outcome as blocked
            blocked_call = Call.objects.filter(campaign_id=self.test_campaign.id).first()
            self.assertEqual(blocked_call.status, 'failed')
            self.assertEqual(blocked_call.outcome, 'blocked')
            self.assertIn("NDNC", blocked_call.notes)
            
            # Verify the blocked event was logged in history
            self.assertTrue(CallEvent.objects.filter(call=blocked_call, event_type="ndnc_blocked").exists())

    # Case H: Launching should fail if business has insufficient call credits
    def test_launch_fails_with_insufficient_credits(self):
        # Set up Twilio credentials and associate contact
        TwilioCredentials.objects.create(
            business=self.test_business,
            account_sid="AC_mock_twilio_account_sid_99999",
            auth_token="encryptedtokensecret",
            phone_number="+1234567890"
        )
        CampaignCustomer.objects.create(
            campaign=self.test_campaign,
            customer_id=self.test_customer.id
        )
        
        # Set business call credits to 0
        self.test_business.call_credits = 0
        self.test_business.save()
        
        response = self.client.post(self.launch_url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Insufficient call credits", response.data['error'])

    def test_campaign_create_and_launch_with_dynamic_filters(self):
        # 1. Create Twilio credentials so launching is allowed
        TwilioCredentials.objects.create(
            business=self.test_business,
            account_sid="AC_mock_twilio_account_sid_99999",
            auth_token="encryptedtokensecret",
            phone_number="+1234567890"
        )

        # Clear existing customers and create specific ones for filters
        Customer.objects.all().delete()
        delhi_customer = Customer.objects.create(
            business=self.test_business,
            full_name="Aman Gupta",
            phone="+919812345011",
            city="Delhi",
            consent_status="granted"
        )
        mumbai_customer = Customer.objects.create(
            business=self.test_business,
            full_name="Bhavesh Patel",
            phone="+919812345012",
            city="Mumbai",
            consent_status="granted"
        )

        # 2. Call campaign creation endpoint with dynamic filter groups matching city = "Delhi"
        payload = {
            "name": "Dynamic Festival Offer",
            "purpose": "promotional",
            "language": "en",
            "voiceType": "female_friendly",
            "scriptText": "Hi [Customer Name], happy Diwali! Press 9 to opt-out.",
            "complianceConfirmed": True,
            "filterGroups": [
                {
                    "logic_operator": "AND",
                    "rules": [
                        {"field_name": "city", "operator": "EQUALS", "value": "Delhi"}
                    ]
                }
            ]
        }

        response = self.client.post('/api/campaigns', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        campaign_id = response.data['campaign']['id']
        campaign = Campaign.objects.get(id=campaign_id)
        self.assertEqual(campaign.name, "Dynamic Festival Offer")
        self.assertEqual(campaign.total_contacts, 1) # only Aman Gupta matches Delhi
        self.assertTrue(campaign.filter_groups.exists())
        self.assertEqual(campaign.filter_groups.first().rules.first().field_name, "city")

        # 3. Launch the campaign
        launch_url = reverse('campaign_launch', kwargs={'id': campaign.id})
        with patch('campaigns.dialer.is_trai_compliant_time', return_value=True), \
             patch('campaigns.dialer.run_live_campaign_dialer') as mock_dialer:
            launch_response = self.client.post(launch_url)
            self.assertEqual(launch_response.status_code, status.HTTP_200_OK)
            mock_dialer.assert_called_once()

            # Re-fetch campaign
            campaign.refresh_from_db()
            self.assertEqual(campaign.status, "scheduled")
            self.assertEqual(campaign.channel_type, 1)

            # Check that only Aman Gupta got a queued call
            queued_calls = Call.objects.filter(campaign_id=campaign.id)
            self.assertEqual(queued_calls.count(), 1)
            self.assertEqual(queued_calls.first().customer_id, delhi_customer.id)
            self.assertEqual(queued_calls.first().status, "queued")

            # Check that 1 credit was deducted from the business (500 -> 499)
            self.test_business.refresh_from_db()
            self.assertEqual(self.test_business.call_credits, 499)