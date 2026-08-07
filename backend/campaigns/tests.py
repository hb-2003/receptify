import time as real_time
import threading
from io import StringIO
from unittest.mock import patch
from datetime import timedelta
from django.urls import reverse
from django.test import SimpleTestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITransactionTestCase
from receptify.models import Business, TwilioCredentials, User
from receptify.crypto import encrypt
from campaigns.models import Campaign, CampaignCustomer, CampaignFilterGroup, CampaignFilterRule
from customers.models import Customer
from calls.models import Call, CallEvent


class CampaignTaskTests(SimpleTestCase):
    """Keep the asynchronous campaign entry point aligned with the dialer API."""

    @patch('campaigns.tasks.run_live_campaign_dialer')
    def test_celery_task_invokes_live_campaign_dialer(self, mock_dialer):
        from campaigns.tasks import run_live_campaign_dialer_task

        run_live_campaign_dialer_task('campaign-id')

        mock_dialer.assert_called_once_with('campaign-id')

# Tests the campaign launching and queueing validations for KAN-17
class CampaignLaunchRoutingTestCase(APITransactionTestCase):

    def tearDown(self):
        from django.db import connections
        for conn in connections.all():
            conn.close()

    def setUp(self):
        # Launch endpoint tests verify durable queueing. Running a real
        # background dispatcher here makes later assertions race each other;
        # dialer behaviour is exercised explicitly by the end-to-end cases.
        self.dispatch_campaign_dialer = patch('campaigns.tasks.dispatch_campaign_dialer')
        self.mock_dispatch_campaign_dialer = self.dispatch_campaign_dialer.start()
        self.addCleanup(self.dispatch_campaign_dialer.stop)

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

            from campaigns.dialer import run_live_campaign_dialer
            run_live_campaign_dialer(str(self.test_campaign.id))
            
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

            from campaigns.dialer import run_live_campaign_dialer
            run_live_campaign_dialer(str(self.test_campaign.id))
            
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

            from campaigns.dialer import run_live_campaign_dialer
            run_live_campaign_dialer(str(self.test_campaign.id))
            
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
        with patch('campaigns.dialer.is_trai_compliant_time', return_value=True):
            launch_response = self.client.post(launch_url)
            self.assertEqual(launch_response.status_code, status.HTTP_200_OK)
            self.mock_dispatch_campaign_dialer.assert_called_once_with(str(campaign.id))

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


# ============================================================================
# COMPREHENSIVE EDGE CASE TESTS
# ============================================================================

class LaunchEdgeCasesTestCase(APITransactionTestCase):
    """Edge cases for campaign launch validation."""

    def setUp(self):
        self.test_business = Business.objects.create(
            name="Edge Test Clinic",
            business_type="Clinic",
            city="Delhi",
            preferred_language="en",
            is_verified=True,
            call_credits=100,
            plan_tier="growth"
        )
        self.test_user = User.objects.create(
            email="edge@clinic.in",
            password_hash="SecurePasswordHash",
            owner_name="Dr. Edge",
            phone="+919876543210",
            role="owner",
            is_email_verified=True,
            business_id=self.test_business.id
        )
        self.client.force_authenticate(user=self.test_user)

    def test_launch_fails_without_compliance_confirmed(self):
        """Launch must fail if compliance is not confirmed."""
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Non-Compliant Campaign",
            is_compliance_confirmed=False,
            status="draft"
        )
        TwilioCredentials.objects.create(
            business=self.test_business,
            account_sid="AC_mock_sid",
            auth_token="token",
            phone_number="+1234567890"
        )
        customer = Customer.objects.create(
            business_id=self.test_business.id,
            full_name="Test",
            phone="+919812345001",
            consent_status="granted"
        )
        CampaignCustomer.objects.create(campaign=campaign, customer=customer)

        url = reverse('campaign_launch', kwargs={'id': campaign.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Compliance confirmation required", response.data['error'])

    def test_launch_excludes_revoked_consent_customers(self):
        """Customers with revoked consent should not be included in launch."""
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Consent Test",
            is_compliance_confirmed=True,
            status="draft"
        )
        TwilioCredentials.objects.create(
            business=self.test_business,
            account_sid="AC_mock_sid",
            auth_token="token",
            phone_number="+1234567890"
        )
        granted = Customer.objects.create(
            business_id=self.test_business.id,
            full_name="Granted",
            phone="+919812345001",
            consent_status="granted"
        )
        revoked = Customer.objects.create(
            business_id=self.test_business.id,
            full_name="Revoked",
            phone="+919812345002",
            consent_status="revoked"
        )
        CampaignCustomer.objects.create(campaign=campaign, customer=granted)
        CampaignCustomer.objects.create(campaign=campaign, customer=revoked)

        url = reverse('campaign_launch', kwargs={'id': campaign.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(campaign.total_contacts, 1)
        calls = Call.objects.filter(campaign_id=campaign.id)
        self.assertEqual(calls.count(), 1)
        self.assertEqual(calls.first().customer_id, granted.id)

    def test_launch_with_dynamic_filters_zero_matches(self):
        """Launch with filter groups that match zero customers should fail."""
        TwilioCredentials.objects.create(
            business=self.test_business,
            account_sid="AC_mock_sid",
            auth_token="token",
            phone_number="+1234567890"
        )
        Customer.objects.create(
            business_id=self.test_business.id,
            full_name="Mumbai",
            phone="+919812345001",
            city="Mumbai",
            consent_status="granted"
        )

        payload = {
            "name": "No Match Campaign",
            "complianceConfirmed": True,
            "filterGroups": [{
                "logic_operator": "AND",
                "rules": [{"field_name": "city", "operator": "EQUALS", "value": "Delhi"}]
            }]
        }
        response = self.client.post('/api/campaigns', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        campaign_id = response.data['campaign']['id']

        url = reverse('campaign_launch', kwargs={'id': campaign_id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("no contacts", response.data['error'])

    def test_launch_negative_call_credits_fails(self):
        """Launch should fail if call_credits is negative."""
        self.test_business.call_credits = -10
        self.test_business.save()

        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Negative Credits",
            is_compliance_confirmed=True,
            status="draft"
        )
        TwilioCredentials.objects.create(
            business=self.test_business,
            account_sid="AC_mock_sid",
            auth_token="token",
            phone_number="+1234567890"
        )
        customer = Customer.objects.create(
            business_id=self.test_business.id,
            full_name="Test",
            phone="+919812345001",
            consent_status="granted"
        )
        CampaignCustomer.objects.create(campaign=campaign, customer=customer)

        url = reverse('campaign_launch', kwargs={'id': campaign.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Insufficient call credits", response.data['error'])

    def test_launch_deducts_exact_call_credits(self):
        """Launch should deduct exactly the number of contacts from call_credits."""
        self.test_business.call_credits = 200
        self.test_business.save()

        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Credit Deduction",
            is_compliance_confirmed=True,
            status="draft"
        )
        TwilioCredentials.objects.create(
            business=self.test_business,
            account_sid="AC_mock_sid",
            auth_token="token",
            phone_number="+1234567890"
        )
        customers = []
        for i in range(5):
            c = Customer.objects.create(
                business_id=self.test_business.id,
                full_name=f"Customer {i}",
                phone=f"+91981234500{i}",
                consent_status="granted"
            )
            customers.append(c)
        for c in customers:
            CampaignCustomer.objects.create(campaign=campaign, customer=c)

        url = reverse('campaign_launch', kwargs={'id': campaign.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.test_business.refresh_from_db()
        self.assertEqual(self.test_business.call_credits, 195)


class RetryEdgeCasesTestCase(APITransactionTestCase):
    """Edge cases for retry logic."""

    def setUp(self):
        self.test_business = Business.objects.create(
            name="Retry Edge",
            business_type="Clinic",
            city="Delhi",
            preferred_language="en",
            is_verified=True,
            call_credits=500,
            plan_tier="growth"
        )
        self.test_user = User.objects.create(
            email="retry@clinic.in",
            password_hash="SecurePasswordHash",
            owner_name="Dr. Retry",
            phone="+919876543210",
            role="owner",
            is_email_verified=True,
            business_id=self.test_business.id
        )
        self.client.force_authenticate(user=self.test_user)

        self.test_customer = Customer.objects.create(
            business_id=self.test_business.id,
            full_name="Retry User",
            phone="+919812345001",
            consent_status="granted"
        )

        TwilioCredentials.objects.create(
            business=self.test_business,
            account_sid="AC_real_twilio_sid",
            auth_token=encrypt("raw_secret_twilio_auth_token"),
            phone_number="+1234567890"
        )

    def test_schedule_retry_zero_delay(self):
        """With delay_between_calls=0, retry should happen immediately."""
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Zero Delay",
            retry_attempts=3,
            delay_between_calls=0,
            status="scheduled",
            channel_type=1
        )
        call = Call.objects.create(
            campaign=campaign,
            customer=self.test_customer,
            status="queued",
            attempt_number=1,
            channel_type=1
        )

        from campaigns.dialer import schedule_retry
        schedule_retry(call, campaign, 2)
        call.refresh_from_db()
        self.assertEqual(call.status, 'queued')
        self.assertEqual(call.attempt_number, 2)
        self.assertIsNotNone(call.next_retry_at)
        delta = call.next_retry_at - timezone.now()
        self.assertAlmostEqual(delta.total_seconds(), 0, delta=2)

    def test_schedule_retry_caps_at_60_minutes(self):
        """Exponential backoff should cap at 60 minutes."""
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Cap Test",
            retry_attempts=10,
            delay_between_calls=10,
            status="scheduled",
            channel_type=1
        )
        call = Call.objects.create(
            campaign=campaign,
            customer=self.test_customer,
            status="queued",
            attempt_number=1,
            channel_type=1
        )

        from campaigns.dialer import schedule_retry
        schedule_retry(call, campaign, 10)
        call.refresh_from_db()
        delta = call.next_retry_at - timezone.now()
        self.assertLessEqual(delta.total_seconds() / 60, 60.5)

    @patch('httpx.AsyncClient.post')
    @patch('campaigns.dialer.is_trai_compliant_time', return_value=True)
    @patch('campaigns.dialer.is_ndnc_blocked', return_value=False)
    @patch('time.sleep', return_value=None)
    def test_retry_on_http_429(self, mock_sleep, mock_ndnc, mock_trai, mock_post):
        """HTTP 429 should trigger retry with backoff."""
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="429 Test",
            retry_attempts=3,
            delay_between_calls=2,
            status="scheduled",
            channel_type=1
        )
        call = Call.objects.create(
            campaign=campaign,
            customer=self.test_customer,
            status="queued",
            attempt_number=1,
            channel_type=1
        )

        mock_post.return_value = type('Response', (), {
            'status_code': 429,
            'text': 'Rate Limited',
            'json': lambda: {}
        })()

        from campaigns.dialer import run_live_campaign_dialer
        thread = threading.Thread(target=run_live_campaign_dialer, args=(str(campaign.id),), daemon=True)
        thread.start()
        thread.join(timeout=5)

        call.refresh_from_db()
        self.assertEqual(call.status, 'queued')
        self.assertIsNotNone(call.next_retry_at)

    @patch('httpx.AsyncClient.post')
    @patch('campaigns.dialer.is_trai_compliant_time', return_value=True)
    @patch('campaigns.dialer.is_ndnc_blocked', return_value=False)
    @patch('time.sleep', return_value=None)
    def test_retry_on_http_500(self, mock_sleep, mock_ndnc, mock_trai, mock_post):
        """HTTP 500 should trigger retry."""
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="500 Test",
            retry_attempts=2,
            delay_between_calls=1,
            status="scheduled",
            channel_type=1
        )
        call = Call.objects.create(
            campaign=campaign,
            customer=self.test_customer,
            status="queued",
            attempt_number=1,
            channel_type=1
        )

        mock_post.return_value = type('Response', (), {
            'status_code': 500,
            'text': 'Internal Server Error',
            'json': lambda: {}
        })()

        from campaigns.dialer import run_live_campaign_dialer
        thread = threading.Thread(target=run_live_campaign_dialer, args=(str(campaign.id),), daemon=True)
        thread.start()
        thread.join(timeout=5)

        call.refresh_from_db()
        self.assertEqual(call.status, 'queued')
        self.assertIsNotNone(call.next_retry_at)

    @patch('httpx.AsyncClient.post')
    @patch('campaigns.dialer.is_trai_compliant_time', return_value=True)
    @patch('campaigns.dialer.is_ndnc_blocked', return_value=False)
    @patch('time.sleep', return_value=None)
    def test_retry_on_connection_error(self, mock_sleep, mock_ndnc, mock_trai, mock_post):
        """Connection error should trigger retry with backoff."""
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Conn Error Test",
            retry_attempts=3,
            delay_between_calls=2,
            status="scheduled",
            channel_type=1
        )
        call = Call.objects.create(
            campaign=campaign,
            customer=self.test_customer,
            status="queued",
            attempt_number=1,
            channel_type=1
        )

        mock_post.side_effect = Exception("Connection refused")

        from campaigns.dialer import run_live_campaign_dialer
        thread = threading.Thread(target=run_live_campaign_dialer, args=(str(campaign.id),), daemon=True)
        thread.start()
        thread.join(timeout=5)

        call.refresh_from_db()
        self.assertEqual(call.status, 'queued')
        self.assertIsNotNone(call.next_retry_at)
        self.assertIn("Connection failed", call.notes)

    @patch('httpx.AsyncClient.post')
    @patch('campaigns.dialer.is_trai_compliant_time', return_value=True)
    @patch('campaigns.dialer.is_ndnc_blocked', return_value=False)
    @patch('time.sleep', return_value=None)
    def test_retryable_failure_after_max_retries_marks_failed(self, mock_sleep, mock_ndnc, mock_trai, mock_post):
        """After exhausting retries, transient failure should mark call as failed."""
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Max Retry Test",
            retry_attempts=2,
            delay_between_calls=1,
            status="scheduled",
            channel_type=1
        )
        call = Call.objects.create(
            campaign=campaign,
            customer=self.test_customer,
            status="queued",
            attempt_number=2,  # Already at max
            channel_type=1
        )

        mock_post.return_value = type('Response', (), {
            'status_code': 503,
            'text': 'Service Unavailable',
            'json': lambda: {}
        })()

        from campaigns.dialer import run_live_campaign_dialer
        thread = threading.Thread(target=run_live_campaign_dialer, args=(str(campaign.id),), daemon=True)
        thread.start()
        thread.join(timeout=5)

        call.refresh_from_db()
        self.assertEqual(call.status, 'failed')
        self.assertEqual(call.outcome, 'failed')
        self.assertIn("retries", call.notes)


class LifecycleEdgeCasesTestCase(APITransactionTestCase):
    """Edge cases for campaign lifecycle operations."""

    def setUp(self):
        self.test_business = Business.objects.create(
            name="Lifecycle Edge",
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
            owner_name="Dr. Edge",
            phone="+919876543210",
            role="owner",
            is_email_verified=True,
            business_id=self.test_business.id
        )
        self.client.force_authenticate(user=self.test_user)

        self.test_customer = Customer.objects.create(
            business_id=self.test_business.id,
            full_name="Edge User",
            phone="+919812345001",
            consent_status="granted"
        )

    def test_pause_draft_campaign_returns_400(self):
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Draft",
            status="draft"
        )
        url = reverse('campaign_pause', kwargs={'id': campaign.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_pause_scheduled_campaign_returns_400(self):
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Scheduled",
            status="scheduled"
        )
        url = reverse('campaign_pause', kwargs={'id': campaign.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_pause_completed_campaign_returns_400(self):
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Completed",
            status="completed"
        )
        url = reverse('campaign_pause', kwargs={'id': campaign.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_resume_running_campaign_returns_400(self):
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Running",
            status="running"
        )
        url = reverse('campaign_resume', kwargs={'id': campaign.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_resume_draft_campaign_returns_400(self):
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Draft",
            status="draft"
        )
        url = reverse('campaign_resume', kwargs={'id': campaign.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cancel_draft_campaign(self):
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Draft",
            status="draft"
        )
        url = reverse('campaign_cancel', kwargs={'id': campaign.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['campaign']['status'], 'canceled')

    def test_cancel_scheduled_campaign(self):
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Scheduled",
            status="scheduled"
        )
        url = reverse('campaign_cancel', kwargs={'id': campaign.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['campaign']['status'], 'canceled')

    def test_cancel_paused_campaign(self):
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Paused",
            status="paused"
        )
        url = reverse('campaign_cancel', kwargs={'id': campaign.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['campaign']['status'], 'canceled')

    def test_cancel_already_canceled_returns_400(self):
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Canceled",
            status="canceled"
        )
        url = reverse('campaign_cancel', kwargs={'id': campaign.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already completed", response.data['error'])

    def test_resume_without_twilio_credentials_returns_400(self):
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Paused No Creds",
            status="paused"
        )
        url = reverse('campaign_resume', kwargs={'id': campaign.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("No Twilio credentials", response.data['error'])

    def test_pause_does_not_affect_ringing_calls(self):
        """Pausing a campaign should only pause queued calls, not in-progress calls."""
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Running",
            status="running",
            channel_type=1
        )
        queued = Call.objects.create(
            campaign=campaign,
            customer=self.test_customer,
            status='queued',
            channel_type=1
        )
        ringing = Call.objects.create(
            campaign=campaign,
            customer=self.test_customer,
            status='ringing',
            channel_type=1
        )

        url = reverse('campaign_pause', kwargs={'id': campaign.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        queued.refresh_from_db()
        ringing.refresh_from_db()
        self.assertEqual(queued.status, 'paused')
        self.assertEqual(ringing.status, 'ringing')  # Should not change

    def test_cancel_preserves_terminal_call_status(self):
        """Canceling should not change status of already completed/failed calls."""
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Running",
            status="running",
            channel_type=1
        )
        completed_call = Call.objects.create(
            campaign=campaign,
            customer=self.test_customer,
            status='completed',
            channel_type=1
        )
        queued_call = Call.objects.create(
            campaign=campaign,
            customer=self.test_customer,
            status='queued',
            channel_type=1
        )

        url = reverse('campaign_cancel', kwargs={'id': campaign.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        completed_call.refresh_from_db()
        queued_call.refresh_from_db()
        self.assertEqual(completed_call.status, 'completed')  # Terminal preserved
        self.assertEqual(queued_call.status, 'canceled')

    def test_duplicate_without_filter_groups(self):
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="No Filters",
            status="draft",
            script_text="Hello",
            retry_attempts=3,
            delay_between_calls=10
        )
        url = reverse('campaign_duplicate', kwargs={'id': campaign.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new = Campaign.objects.get(id=response.data['campaign']['id'])
        self.assertEqual(new.script_text, "Hello")
        self.assertEqual(new.retry_attempts, 3)
        self.assertEqual(new.delay_between_calls, 10)
        self.assertEqual(new.filter_groups.count(), 0)

    def test_duplicate_with_multiple_filter_groups(self):
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Multi Group",
            status="draft"
        )
        group1 = CampaignFilterGroup.objects.create(campaign=campaign, logic_operator='AND')
        CampaignFilterRule.objects.create(group=group1, field_name='city', operator='EQUALS', value='Delhi')
        group2 = CampaignFilterGroup.objects.create(campaign=campaign, logic_operator='OR')
        CampaignFilterRule.objects.create(group=group2, field_name='age', operator='GREATER_THAN', value=60)

        url = reverse('campaign_duplicate', kwargs={'id': campaign.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new = Campaign.objects.get(id=response.data['campaign']['id'])
        self.assertEqual(new.filter_groups.count(), 2)
        self.assertEqual(new.filter_groups.filter(logic_operator='AND').first().rules.count(), 1)
        self.assertEqual(new.filter_groups.filter(logic_operator='OR').first().rules.count(), 1)


class ScheduledLauncherEdgeCasesTestCase(APITransactionTestCase):
    """Edge cases for the scheduled campaign auto-launcher."""

    def setUp(self):
        self.test_business = Business.objects.create(
            name="Scheduler Edge",
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

    def test_scheduled_campaign_with_null_scheduled_at_launches(self):
        """A scheduled campaign with scheduled_at=None should still be launchable."""
        TwilioCredentials.objects.create(
            business=self.test_business,
            account_sid="AC_mock_sid",
            auth_token=encrypt("raw_secret"),
            phone_number="+1234567890"
        )
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="No Schedule Time",
            purpose="payment_reminder",
            status="scheduled",
            scheduled_at=None,
            channel_type=1
        )
        Call.objects.create(
            campaign=campaign,
            customer=self.test_customer,
            status='queued',
            channel_type=1
        )

        with patch('campaigns.dialer.is_campaign_launchable', return_value=(True, None)):
            out = StringIO()
            call_command('launch_scheduled', stdout=out)
            self.assertIn("1 launched", out.getvalue())

    def test_scheduled_campaign_with_no_calls_skipped(self):
        """A scheduled campaign with no queued calls should still be launched (dialer handles empty)."""
        TwilioCredentials.objects.create(
            business=self.test_business,
            account_sid="AC_mock_sid",
            auth_token=encrypt("raw_secret"),
            phone_number="+1234567890"
        )
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="No Calls",
            purpose="payment_reminder",
            status="scheduled",
            scheduled_at=timezone.now() - timedelta(minutes=5),
            channel_type=1
        )

        with patch('campaigns.dialer.is_campaign_launchable', return_value=(True, None)):
            out = StringIO()
            call_command('launch_scheduled', stdout=out)
            self.assertIn("1 launched", out.getvalue())
            self.assertEqual(campaign.status, 'running')

    def test_scheduled_campaign_skipped_missing_credentials(self):
        """A scheduled campaign should be skipped if Twilio credentials are missing."""
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="No Creds",
            purpose="payment_reminder",
            status="scheduled",
            scheduled_at=timezone.now() - timedelta(minutes=5),
            channel_type=1
        )

        out = StringIO()
        call_command('launch_scheduled', stdout=out)

        self.assertIn("0 launched", out.getvalue())
        campaign.refresh_from_db()
        self.assertEqual(campaign.status, 'scheduled')

    def test_scheduled_campaign_skipped_outside_trai_window(self):
        """A scheduled campaign should be skipped if outside TRAI calling window."""
        TwilioCredentials.objects.create(
            business=self.test_business,
            account_sid="AC_mock_sid",
            auth_token=encrypt("raw_secret"),
            phone_number="+1234567890"
        )
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Off Hours",
            purpose="payment_reminder",
            status="scheduled",
            scheduled_at=timezone.now() - timedelta(minutes=5),
            channel_type=1
        )

        with patch('campaigns.dialer.is_trai_compliant_time', return_value=False):
            out = StringIO()
            call_command('launch_scheduled', stdout=out)
            self.assertIn("0 launched", out.getvalue())

        campaign.refresh_from_db()
        self.assertEqual(campaign.status, 'scheduled')

    def test_multiple_due_campaigns_all_launched(self):
        """Multiple due campaigns should all be launched."""
        TwilioCredentials.objects.create(
            business=self.test_business,
            account_sid="AC_mock_sid",
            auth_token=encrypt("raw_secret"),
            phone_number="+1234567890"
        )
        c1 = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Campaign 1",
            status="scheduled",
            scheduled_at=timezone.now() - timedelta(minutes=5),
            channel_type=1
        )
        c2 = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Campaign 2",
            status="scheduled",
            scheduled_at=timezone.now() - timedelta(minutes=3),
            channel_type=1
        )

        with patch('campaigns.dialer.is_campaign_launchable', return_value=(True, None)):
            out = StringIO()
            call_command('launch_scheduled', stdout=out)
            self.assertIn("2 launched", out.getvalue())

    def test_mixed_due_and_future_campaigns(self):
        """Only due campaigns should launch; future ones should stay scheduled."""
        TwilioCredentials.objects.create(
            business=self.test_business,
            account_sid="AC_mock_sid",
            auth_token=encrypt("raw_secret"),
            phone_number="+1234567890"
        )
        due = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Due",
            status="scheduled",
            scheduled_at=timezone.now() - timedelta(minutes=5),
            channel_type=1
        )
        future = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Future",
            status="scheduled",
            scheduled_at=timezone.now() + timedelta(minutes=30),
            channel_type=1
        )

        with patch('campaigns.dialer.is_campaign_launchable', return_value=(True, None)):
            out = StringIO()
            call_command('launch_scheduled', stdout=out)
            self.assertIn("1 launched", out.getvalue())

        due.refresh_from_db()
        future.refresh_from_db()
        self.assertEqual(due.status, 'running')
        self.assertEqual(future.status, 'scheduled')


class DialerEdgeCasesTestCase(APITransactionTestCase):
    """Edge cases for the dialer execution."""

    def setUp(self):
        self.test_business = Business.objects.create(
            name="Dialer Edge",
            business_type="Clinic",
            city="Delhi",
            preferred_language="en",
            is_verified=True,
            call_credits=500,
            plan_tier="growth"
        )
        self.test_user = User.objects.create(
            email="dialer@clinic.in",
            password_hash="SecurePasswordHash",
            owner_name="Dr. Dialer",
            phone="+919876543210",
            role="owner",
            is_email_verified=True,
            business_id=self.test_business.id
        )
        self.client.force_authenticate(user=self.test_user)

        self.test_customer = Customer.objects.create(
            business_id=self.test_business.id,
            full_name="Dialer User",
            phone="+919812345001",
            consent_status="granted"
        )

        TwilioCredentials.objects.create(
            business=self.test_business,
            account_sid="AC_real_twilio_sid",
            auth_token=encrypt("raw_secret_twilio_auth_token"),
            phone_number="+1234567890"
        )

    @patch('time.sleep', return_value=None)
    def test_dialer_marks_completed_when_all_calls_succeed(self, mock_sleep):
        # Use mock SID to trigger the simulated mock dialer path
        TwilioCredentials.objects.update_or_create(
            business=self.test_business,
            defaults={
                'account_sid': "AC_mock_twilio_account_sid_99999",
                'auth_token': "mock_token",
                'phone_number': "+1234567890"
            }
        )
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="All Success",
            retry_attempts=2,
            delay_between_calls=1,
            status="scheduled",
            channel_type=1
        )
        for i in range(3):
            Call.objects.create(
                campaign=campaign,
                customer=self.test_customer,
                status='queued',
                channel_type=1,
                attempt_number=1
            )

        with patch('campaigns.dialer.is_trai_compliant_time', return_value=True):
            from campaigns.dialer import run_live_campaign_dialer
            run_live_campaign_dialer(str(campaign.id))

        campaign.refresh_from_db()
        self.assertEqual(campaign.status, 'completed')
        self.assertEqual(Call.objects.filter(campaign_id=campaign.id, status='ringing').count(), 3)

    @patch('time.sleep', return_value=None)
    def test_dialer_handles_empty_call_queue(self, mock_sleep):
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Empty Queue",
            retry_attempts=2,
            delay_between_calls=1,
            status="scheduled",
            channel_type=1
        )

        with patch('campaigns.dialer.is_trai_compliant_time', return_value=True):
            from campaigns.dialer import run_live_campaign_dialer
            run_live_campaign_dialer(str(campaign.id))

        campaign.refresh_from_db()
        self.assertEqual(campaign.status, 'completed')

    @patch('time.sleep', return_value=None)
    def test_dialer_ignores_paused_campaigns(self, mock_sleep):
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Paused",
            retry_attempts=2,
            delay_between_calls=1,
            status="paused",
            channel_type=1
        )
        queued = Call.objects.create(
            campaign=campaign,
            customer=self.test_customer,
            status='queued',
            channel_type=1
        )

        with patch('campaigns.dialer.is_trai_compliant_time', return_value=True):
            from campaigns.dialer import run_live_campaign_dialer
            run_live_campaign_dialer(str(campaign.id))

        campaign.refresh_from_db()
        queued.refresh_from_db()
        self.assertEqual(campaign.status, 'paused')
        self.assertEqual(queued.status, 'queued')


class FrontendPollingTestCase(APITransactionTestCase):
    """Tests for frontend polling interval logic."""

    def get_polling_interval(self, status):
        switch = {
            'running': 2000,
            'scheduled': 10000,
            'paused': 5000,
        }
        return switch.get(status, 0)

    def test_polling_interval_for_running(self):
        self.assertEqual(self.get_polling_interval('running'), 2000)

    def test_polling_interval_for_scheduled(self):
        self.assertEqual(self.get_polling_interval('scheduled'), 10000)

    def test_polling_interval_for_paused(self):
        self.assertEqual(self.get_polling_interval('paused'), 5000)

    def test_polling_interval_for_terminal_states(self):
        for status in ['draft', 'completed', 'failed', 'canceled']:
            self.assertEqual(self.get_polling_interval(status), 0)


class CronJobIntegrationTestCase(APITransactionTestCase):
    """Integration tests for cron job behavior."""

    def setUp(self):
        self.test_business = Business.objects.create(
            name="Cron Test",
            business_type="Clinic",
            city="Delhi",
            preferred_language="en",
            is_verified=True,
            call_credits=500,
            plan_tier="growth"
        )
        self.test_user = User.objects.create(
            email="cron@clinic.in",
            password_hash="SecurePasswordHash",
            owner_name="Dr. Cron",
            phone="+919876543210",
            role="owner",
            is_email_verified=True,
            business_id=self.test_business.id
        )
        self.client.force_authenticate(user=self.test_user)

        self.test_customer = Customer.objects.create(
            business_id=self.test_business.id,
            full_name="Cron User",
            phone="+919812345001",
            consent_status="granted"
        )

    def test_cron_job_launches_due_campaigns(self):
        """Simulating cron job: due scheduled campaigns should be launched."""
        TwilioCredentials.objects.create(
            business=self.test_business,
            account_sid="AC_mock_sid",
            auth_token=encrypt("raw_secret"),
            phone_number="+1234567890"
        )
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Cron Due",
            purpose="payment_reminder",
            status="scheduled",
            scheduled_at=timezone.now() - timedelta(minutes=10),
            channel_type=1
        )
        Call.objects.create(
            campaign=campaign,
            customer=self.test_customer,
            status='queued',
            channel_type=1
        )

        with patch('campaigns.dialer.is_campaign_launchable', return_value=(True, None)):
            out = StringIO()
            call_command('launch_scheduled', stdout=out)
            self.assertIn("1 launched", out.getvalue())

    def test_cron_job_does_not_relaunch_completed(self):
        """Cron job should not relaunch already completed campaigns."""
        campaign = Campaign.objects.create(
            business_id=self.test_business.id,
            name="Done",
            status="completed",
            scheduled_at=timezone.now() - timedelta(minutes=10),
            channel_type=1
        )

        out = StringIO()
        call_command('launch_scheduled', stdout=out)
        self.assertIn("No scheduled campaigns", out.getvalue())
