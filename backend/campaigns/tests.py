import time as real_time
import threading
from unittest.mock import patch
from datetime import timedelta
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITransactionTestCase
from receptify.models import Business, TwilioCredentials, User
from receptify.crypto import encrypt
from campaigns.models import Campaign, CampaignCustomer, CampaignFilterGroup, CampaignFilterRule
from customers.models import Customer
from calls.models import Call, CallEvent

# Tests the campaign launching and queueing validations for KAN-17
class CampaignLaunchRoutingTestCase(APITransactionTestCase):

    def tearDown(self):
        from django.db import connections
        for conn in connections.all():
            conn.close()

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
        Customer.objects.create(
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


class CampaignDetailPatchTestCase(APITransactionTestCase):
    # Tests for the PATCH endpoint and filterGroups in GET response on CampaignDetailView.

    def setUp(self):
        self.test_business = Business.objects.create(
            name="Test clinic",
            business_type="Clinic",
            city="Delhi",
            preferred_language="en",
            is_verified=True,
            call_credits=500,
            plan_tier="growth"
        )
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

        self.draft_campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Draft Campaign",
            purpose="payment_reminder",
            language="en",
            voice_type="female_professional",
            script_text="Hello [Customer Name], payment overdue. Press 9 to opt-out.",
            status="draft"
        )

    def test_patch_draft_campaign_updates_fields(self):
        url = reverse('campaign_detail', kwargs={'id': self.draft_campaign.id})
        response = self.client.patch(url, {
            'name': 'Updated Campaign Name',
            'voiceType': 'male_professional',
            'scriptText': 'New script text with opt-out compliance.'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['campaign']['name'], 'Updated Campaign Name')
        self.assertEqual(response.data['campaign']['voiceType'], 'male_professional')

        self.draft_campaign.refresh_from_db()
        self.assertEqual(self.draft_campaign.name, 'Updated Campaign Name')
        self.assertEqual(self.draft_campaign.voice_type, 'male_professional')

    def test_patch_non_draft_campaign_rejected(self):
        self.draft_campaign.status = 'scheduled'
        self.draft_campaign.save()

        url = reverse('campaign_detail', kwargs={'id': self.draft_campaign.id})
        response = self.client.patch(url, {'name': 'Should Fail'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Only draft campaigns can be edited", response.data['error'])

    def test_get_campaign_detail_returns_filter_groups(self):
        from customers.models import Customer
        Customer.objects.create(
            business_id=self.test_business.id,
            full_name="Test Customer",
            phone="+919812345001",
            consent_status="granted"
        )

        url = reverse('campaign_detail', kwargs={'id': self.draft_campaign.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('filterGroups', response.data)
        self.assertEqual(response.data['filterGroups'], [])


class CampaignRetryTestCase(APITransactionTestCase):
    """Tests for call retry logic with exponential backoff in the dialer."""

    def tearDown(self):
        from django.db import connections
        for conn in connections.all():
            conn.close()

    def setUp(self):
        self.test_business = Business.objects.create(
            name="Test clinic",
            business_type="Clinic",
            city="Delhi",
            preferred_language="en",
            is_verified=True,
            call_credits=500,
            plan_tier="growth"
        )
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

        self.test_customer = Customer.objects.create(
            business_id=self.test_business.id,
            full_name="Rajesh Kumar",
            phone="+919812345001",
            consent_status="granted"
        )

        TwilioCredentials.objects.create(
            business=self.test_business,
            account_sid="AC_real_twilio_sid_88888",
            auth_token=encrypt("raw_secret_twilio_auth_token"),
            phone_number="+1234567890"
        )

        self.test_campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Retry Test Campaign",
            purpose="payment_reminder",
            retry_attempts=3,
            delay_between_calls=5,
            status="scheduled",
            channel_type=1
        )

        self.test_call = Call.objects.create(
            campaign=self.test_campaign,
            customer=self.test_customer,
            status="queued",
            outcome="pending",
            attempt_number=1,
            channel_type=1
        )

    @patch('httpx.AsyncClient.post')
    @patch('campaigns.dialer.is_trai_compliant_time', return_value=True)
    @patch('campaigns.dialer.is_ndnc_blocked', return_value=False)
    @patch('time.sleep', return_value=None)
    def test_retryable_failure_schedules_retry(self, mock_sleep, mock_ndnc, mock_trai, mock_post):
        """When Twilio returns a retryable status (503), the call should be scheduled for retry."""
        mock_post.return_value = type('Response', (), {
            'status_code': 503,
            'text': 'Service Unavailable',
            'json': lambda: {}
        })()

        from campaigns.dialer import run_live_campaign_dialer
        thread = threading.Thread(target=run_live_campaign_dialer, args=(str(self.test_campaign.id),), daemon=True)
        thread.start()
        thread.join(timeout=5)

        self.test_call.refresh_from_db()
        # Call should still be queued (scheduled for retry)
        self.assertEqual(self.test_call.status, 'queued')
        self.assertIsNotNone(self.test_call.next_retry_at)

    @patch('httpx.AsyncClient.post')
    @patch('campaigns.dialer.is_trai_compliant_time', return_value=True)
    @patch('campaigns.dialer.is_ndnc_blocked', return_value=False)
    @patch('time.sleep', return_value=None)
    def test_non_retryable_failure_marks_failed(self, mock_sleep, mock_ndnc, mock_trai, mock_post):
        """When Twilio returns a non-retryable status (400), the call should be marked failed immediately."""
        mock_post.return_value = type('Response', (), {
            'status_code': 400,
            'text': 'Bad Request',
            'json': lambda: {}
        })()

        from campaigns.dialer import run_live_campaign_dialer
        thread = threading.Thread(target=run_live_campaign_dialer, args=(str(self.test_campaign.id),), daemon=True)
        thread.start()
        thread.join(timeout=5)

        self.test_call.refresh_from_db()
        self.assertEqual(self.test_call.status, 'failed')
        self.assertEqual(self.test_call.outcome, 'failed')

    def test_exponential_backoff_calculation(self):
        """Exponential backoff delay should double with each attempt, capped at 60 minutes."""
        from campaigns.dialer import schedule_retry

        attempts = [1, 2, 3, 4, 5]
        expected_delays = [5, 10, 20, 40, 60]  # min(5 * 2^(n-1), 60)

        for attempt, expected_delay in zip(attempts, expected_delays):
            schedule_retry(self.test_call, self.test_campaign, attempt)
            self.test_call.refresh_from_db()
            self.assertIsNotNone(self.test_call.next_retry_at)
            actual_delta = self.test_call.next_retry_at - timezone.now()
            self.assertAlmostEqual(
                actual_delta.total_seconds() / 60,
                expected_delay,
                delta=1.0
            )

    @patch('httpx.AsyncClient.post')
    @patch('campaigns.dialer.is_trai_compliant_time', return_value=True)
    @patch('campaigns.dialer.is_ndnc_blocked', return_value=False)
    @patch('time.sleep', return_value=None)
    def test_max_retries_auto_skip(self, mock_sleep, mock_ndnc, mock_trai, mock_post):
        """After max retries, the call should be marked failed (auto-skip)."""
        self.test_call.attempt_number = self.test_campaign.retry_attempts  # Already at max
        self.test_call.save()

        mock_post.return_value = type('Response', (), {
            'status_code': 503,
            'text': 'Service Unavailable',
            'json': lambda: {}
        })()

        from campaigns.dialer import run_live_campaign_dialer
        thread = threading.Thread(target=run_live_campaign_dialer, args=(str(self.test_campaign.id),), daemon=True)
        thread.start()
        thread.join(timeout=5)

        self.test_call.refresh_from_db()
        self.assertEqual(self.test_call.status, 'failed')
        self.assertIn("retries", self.test_call.notes)


class CampaignLifecycleTestCase(APITransactionTestCase):
    """Tests for campaign pause, resume, cancel, and duplicate endpoints."""

    def setUp(self):
        self.test_business = Business.objects.create(
            name="Test clinic",
            business_type="Clinic",
            city="Delhi",
            preferred_language="en",
            is_verified=True,
            call_credits=500,
            plan_tier="growth"
        )
        self.test_user = User.objects.create(
            email="lifecycle@clinic.in",
            password_hash="SecurePasswordHash",
            owner_name="Dr. Sharma",
            phone="+919876543210",
            role="owner",
            is_email_verified=True,
            business_id=self.test_business.id
        )
        self.client.force_authenticate(user=self.test_user)

        self.test_customer = Customer.objects.create(
            business_id=self.test_business.id,
            full_name="Lifecycle User",
            phone="+919812345001",
            consent_status="granted"
        )

        self.test_campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Lifecycle Test",
            purpose="payment_reminder",
            retry_attempts=2,
            delay_between_calls=5,
            status="running",
            channel_type=1
        )

        self.queued_call = Call.objects.create(
            campaign=self.test_campaign,
            customer=self.test_customer,
            status='queued',
            channel_type=1,
            attempt_number=1
        )

    def test_pause_running_campaign(self):
        """Pause endpoint should transition a running campaign to paused."""
        url = reverse('campaign_pause', kwargs={'id': self.test_campaign.id})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['campaign']['status'], 'paused')

        self.test_campaign.refresh_from_db()
        self.assertEqual(self.test_campaign.status, 'paused')

    def test_pause_non_running_campaign_returns_400(self):
        """Cannot pause a campaign that isn't running."""
        self.test_campaign.status = 'draft'
        self.test_campaign.save()

        url = reverse('campaign_pause', kwargs={'id': self.test_campaign.id})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Only running campaigns can be paused", response.data['error'])

    def test_pause_sets_queued_calls_to_paused(self):
        """Pausing a running campaign should also pause queued calls."""
        url = reverse('campaign_pause', kwargs={'id': self.test_campaign.id})
        self.client.post(url)

        self.queued_call.refresh_from_db()
        self.assertEqual(self.queued_call.status, 'paused')

    def test_resume_paused_campaign(self):
        """Resume endpoint should transition a paused campaign back to scheduled."""
        TwilioCredentials.objects.create(
            business=self.test_business,
            account_sid="AC_mock_twilio_account_sid_99999",
            auth_token=encrypt("raw_secret_twilio_auth_token"),
            phone_number="+1234567890"
        )

        self.test_campaign.status = 'paused'
        self.test_campaign.save()
        self.queued_call.status = 'paused'
        self.queued_call.save()

        url = reverse('campaign_resume', kwargs={'id': self.test_campaign.id})
        with patch('threading.Thread') as _:
            response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['campaign']['status'], 'scheduled')

        self.test_campaign.refresh_from_db()
        self.assertEqual(self.test_campaign.status, 'scheduled')

        self.queued_call.refresh_from_db()
        self.assertEqual(self.queued_call.status, 'queued')

    def test_resume_non_paused_campaign_returns_400(self):
        """Cannot resume a campaign that isn't paused."""
        url = reverse('campaign_resume', kwargs={'id': self.test_campaign.id})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Only paused campaigns can be resumed", response.data['error'])

    def test_cancel_running_campaign(self):
        """Cancel endpoint should transition a running campaign to canceled."""
        url = reverse('campaign_cancel', kwargs={'id': self.test_campaign.id})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['campaign']['status'], 'canceled')

        self.test_campaign.refresh_from_db()
        self.assertEqual(self.test_campaign.status, 'canceled')

    def test_cancel_terminal_campaign_returns_400(self):
        """Cannot cancel a campaign that is already in a terminal state."""
        self.test_campaign.status = 'completed'
        self.test_campaign.save()

        url = reverse('campaign_cancel', kwargs={'id': self.test_campaign.id})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already completed", response.data['error'])

    def test_cancel_sets_active_calls_to_canceled(self):
        """Canceling a campaign should set all active calls to canceled."""
        url = reverse('campaign_cancel', kwargs={'id': self.test_campaign.id})
        self.client.post(url)

        self.queued_call.refresh_from_db()
        self.assertEqual(self.queued_call.status, 'canceled')

    def test_duplicate_campaign_creates_new_draft(self):
        """Duplicate endpoint should create a new draft campaign."""
        url = reverse('campaign_duplicate', kwargs={'id': self.test_campaign.id})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['campaign']['status'], 'draft')
        self.assertIn("Copy of", response.data['campaign']['name'])

        new_campaign = Campaign.objects.get(id=response.data['campaign']['id'])
        self.assertNotEqual(new_campaign.id, self.test_campaign.id)
        self.assertEqual(new_campaign.status, 'draft')
        self.assertEqual(new_campaign.total_contacts, 0)
        self.assertEqual(new_campaign.calls_completed, 0)

    def test_duplicate_copies_filter_groups(self):
        """Duplicate should copy filter groups and their rules."""
        CampaignFilterGroup.objects.create(
            campaign=self.test_campaign,
            logic_operator='AND'
        )
        group = CampaignFilterGroup.objects.get(campaign=self.test_campaign)
        CampaignFilterRule.objects.create(
            group=group,
            field_name='city',
            operator='EQUALS',
            value='Delhi'
        )

        url = reverse('campaign_duplicate', kwargs={'id': self.test_campaign.id})
        response = self.client.post(url)

        new_campaign = Campaign.objects.get(id=response.data['campaign']['id'])
        new_groups = CampaignFilterGroup.objects.filter(campaign=new_campaign)
        self.assertEqual(new_groups.count(), 1)
        new_rules = CampaignFilterRule.objects.filter(group=new_groups.first())
        self.assertEqual(new_rules.count(), 1)
        self.assertEqual(new_rules.first().field_name, 'city')

    def test_lifecycle_endpoints_return_404_for_nonexistent_campaign(self):
        """All lifecycle endpoints should return 404 for nonexistent campaigns."""
        fake_id = '00000000-0000-0000-0000-000000000000'
        for endpoint_name in ['campaign_pause', 'campaign_resume', 'campaign_cancel', 'campaign_duplicate']:
            url = reverse(endpoint_name, kwargs={'id': fake_id})
            response = self.client.post(url)
            self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND,
                             f"{endpoint_name} did not return 404")


class ScheduledLauncherTestCase(APITransactionTestCase):
    """Tests for the scheduled campaign auto-launcher management command."""

    def setUp(self):
        self.test_business = Business.objects.create(
            name="Test clinic",
            business_type="Clinic",
            city="Delhi",
            preferred_language="en",
            is_verified=True,
            call_credits=500,
            plan_tier="growth"
        )
        self.test_user = User.objects.create(
            email="scheduler@clinic.in",
            password_hash="SecurePasswordHash",
            owner_name="Dr. Scheduler",
            phone="+919876543210",
            role="owner",
            is_email_verified=True,
            business_id=self.test_business.id
        )
        self.client.force_authenticate(user=self.test_user)

        self.test_customer = Customer.objects.create(
            business_id=self.test_business.id,
            full_name="Scheduler User",
            phone="+919812345001",
            consent_status="granted"
        )

        TwilioCredentials.objects.create(
            business=self.test_business,
            account_sid="AC_mock_twilio_account_sid_99999",
            auth_token=encrypt("raw_secret_twilio_auth_token"),
            phone_number="+1234567890"
        )

    def test_scheduled_campaign_launches_when_due(self):
        """A scheduled campaign with scheduled_at in the past should be launched."""
        from io import StringIO
        from django.core.management import call_command

        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Due Campaign",
            purpose="payment_reminder",
            status="scheduled",
            scheduled_at=timezone.now() - timedelta(minutes=5),
            channel_type=1
        )
        Call.objects.create(
            campaign=campaign,
            customer=self.test_customer,
            status='queued',
            channel_type=1,
            attempt_number=1
        )

        with patch('campaigns.dialer.is_trai_compliant_time', return_value=True):
            out = StringIO()
            call_command('launch_scheduled', stdout=out)

            self.assertIn("1 launched", out.getvalue())

    def test_future_scheduled_campaign_not_launched(self):
        """A scheduled campaign with scheduled_at in the future should NOT be launched."""
        from io import StringIO
        from django.core.management import call_command

        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Future Campaign",
            purpose="payment_reminder",
            status="scheduled",
            scheduled_at=timezone.now() + timedelta(minutes=30),
            channel_type=1
        )

        out = StringIO()
        call_command('launch_scheduled', stdout=out)

        self.assertIn("No scheduled campaigns ready to launch", out.getvalue())
        campaign.refresh_from_db()
        self.assertEqual(campaign.status, 'scheduled')

    def test_trailing_campaign_stays_scheduled_if_outside_trafi_window(self):
        """A scheduled campaign outside TRAI window should be skipped, not launched."""
        from io import StringIO
        from django.core.management import call_command

        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Off-Hours Campaign",
            purpose="payment_reminder",
            status="scheduled",
            scheduled_at=timezone.now() - timedelta(minutes=1),
            channel_type=1
        )

        with patch('campaigns.dialer.is_trai_compliant_time', return_value=False):
            out = StringIO()
            call_command('launch_scheduled', stdout=out)

            self.assertIn("0 launched", out.getvalue())

        campaign.refresh_from_db()
        self.assertEqual(campaign.status, 'scheduled')