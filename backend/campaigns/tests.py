import uuid
import time
from unittest.mock import patch
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase, APIClient
from receptify.models import Business, User
from customers.models import Customer
from campaigns.models import Campaign, CampaignCustomer
from campaigns.views import run_mock_campaign

class CampaignTests(APITestCase):
    def setUp(self):
        # Set up a test business and associated user
        self.business = Business.objects.create(
            name="Apna Kirana Store",
            city="Mumbai",
            business_type="Retail"
        )
        self.user = User.objects.create(
            email="owner@apnakirana.com",
            owner_name="Ramesh Kumar",
            password_hash="hashed_password",
            business=self.business
        )
        
        # Create a customer and associated campaign
        self.customer = Customer.objects.create(
            full_name="Suresh Patel",
            phone="+919876543210",
            business=self.business
        )
        self.campaign = Campaign.objects.create(
            name="Payment Recovery Campaign",
            purpose="payment_reminder",
            language="hi",
            business=self.business,
            is_compliance_confirmed=True
        )
        
        # Associate customer to campaign
        self.campaign_customer = CampaignCustomer.objects.create(
            campaign=self.campaign,
            customer=self.customer
        )

        # Configure API Client and authenticate the user
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_campaign_launch_success(self):
        # Verify that we can launch a draft/ready campaign successfully
        url = f"/api/campaigns/{self.campaign.id}/launch"
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.status, "running")

    def test_campaign_launch_already_running(self):
        # Set the campaign as running in advance
        self.campaign.status = "running"
        self.campaign.save()

        url = f"/api/campaigns/{self.campaign.id}/launch"
        response = self.client.post(url)
        
        # Check that it returns HTTP_200_OK but with alreadyRunning flag set to true
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get("alreadyRunning"))

    def test_campaign_launch_requires_compliance(self):
        # Verify that campaigns cannot be launched without compliance confirmation
        self.campaign.is_compliance_confirmed = False
        self.campaign.save()

        url = f"/api/campaigns/{self.campaign.id}/launch"
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.status, "draft")

    def test_campaign_launch_not_found(self):
        # Verify we get a 404 when launching a non-existent campaign id
        fake_uuid = uuid.uuid4()
        url = f"/api/campaigns/{fake_uuid}/launch"
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @patch("campaigns.views.time.sleep")
    def test_background_worker_sets_failed_status_on_exception(self, mock_sleep):
        # We want to test that if an unexpected error occurs inside the background worker
        # (run_mock_campaign), it transitions the campaign's status to 'failed' rather than
        # leaving it as 'running' forever. This protects records from getting locked.
        
        # Set status as running
        self.campaign.status = "running"
        self.campaign.save()

        # We will trigger an error in the worker by deleting the campaign's customer associations
        # right after the worker loads the campaign. We will mock CampaignCustomer.objects.filter
        # to raise a database exception when called inside the worker.
        with patch("campaigns.models.CampaignCustomer.objects.filter") as mock_filter:
            mock_filter.side_effect = Exception("Database crash simulation")
            
            # Execute worker synchronously for testing purposes
            run_mock_campaign(self.campaign.id)
            
            # Verify the status is now set to 'failed'
            self.campaign.refresh_from_db()
            self.assertEqual(self.campaign.status, "failed")
