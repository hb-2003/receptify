import uuid
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from receptify.models import Business, TwilioCredentials, User
from campaigns.models import Campaign, CampaignCustomer
from customers.models import Customer
from calls.models import Call

# Tests the campaign launching and queueing validations for KAN-17
class CampaignLaunchRoutingTestCase(APITestCase):
    
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