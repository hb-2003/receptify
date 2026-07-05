import uuid
import datetime
from django.utils import timezone
from django.core import mail
from rest_framework.test import APITestCase
from rest_framework import status
from receptify.models import User, Business, VerificationToken

class AuthVerificationTestCase(APITestCase):
    def setUp(self):
        # Create a test business
        self.test_business = Business.objects.create(
            name="Test clinic",
            business_type="Clinic",
            city="Delhi",
            preferred_language="en",
            is_verified=True,
            call_credits=500,
            plan_tier="growth"
        )
        # Create an owner user
        self.test_user = User.objects.create(
            email="test@clinic.in",
            password_hash="SecurePasswordHash",
            owner_name="Dr. Vikram",
            phone="+919876543210",
            role="owner",
            is_email_verified=False,
            business_id=self.test_business.id
        )
        
        self.forgot_url = '/api/auth/forgot-password'
        self.reset_url = '/api/auth/reset-password'
        self.verify_url = '/api/auth/verify-email'
        self.resend_url = '/api/auth/resend-verification'
        self.signup_url = '/api/auth/signup'

    def test_signup_triggers_verification_email(self):
        # Clear out previous mail
        mail.outbox = []
        
        payload = {
            'email': 'new_user@receptify.in',
            'password': 'SecurePassword123',
            'ownerName': 'Rohan Shah',
            'businessName': 'Shah Retailers',
            'phone': '9876543211',
            'businessType': 'Retail',
            'city': 'Mumbai'
        }
        
        response = self.client.post(self.signup_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Verify user is created and is not verified
        user = User.objects.get(email='new_user@receptify.in')
        self.assertFalse(user.is_email_verified)
        
        # Verify a token was generated
        token = VerificationToken.objects.get(user=user, purpose='verification')
        self.assertIsNotNone(token)
        
        # Verify email was "sent" (pushed to outbox)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Verify your Receptify account", mail.outbox[0].subject)
        self.assertIn(str(token.token), mail.outbox[0].body)

    def test_forgot_password_sends_email_if_user_exists(self):
        mail.outbox = []
        payload = {'email': 'test@clinic.in'}
        response = self.client.post(self.forgot_url, payload, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify token is created
        token = VerificationToken.objects.get(user=self.test_user, purpose='reset')
        self.assertIsNotNone(token)
        
        # Verify email sent
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Reset your Receptify password", mail.outbox[0].subject)
        self.assertIn(str(token.token), mail.outbox[0].body)

    def test_forgot_password_does_not_reveal_non_existent_email(self):
        mail.outbox = []
        payload = {'email': 'nonexistent@clinic.in'}
        response = self.client.post(self.forgot_url, payload, format='json')
        
        # Return 200 OK for security (do not disclose account existence)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 0)

    def test_reset_password_with_valid_token(self):
        token = VerificationToken.objects.create(
            user=self.test_user,
            purpose='reset',
            expires_at=timezone.now() + datetime.timedelta(hours=1)
        )
        
        payload = {
            'token': str(token.token),
            'password': 'BrandNewPassword123'
        }
        
        response = self.client.post(self.reset_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify token is deleted
        self.assertFalse(VerificationToken.objects.filter(id=token.id).exists())
        
        # Verify user password hash has changed
        self.test_user.refresh_from_db()
        self.assertNotEqual(self.test_user.password_hash, "SecurePasswordHash")

    def test_reset_password_fails_with_expired_token(self):
        token = VerificationToken.objects.create(
            user=self.test_user,
            purpose='reset',
            expires_at=timezone.now() - datetime.timedelta(hours=1)
        )
        
        payload = {
            'token': str(token.token),
            'password': 'BrandNewPassword123'
        }
        
        response = self.client.post(self.reset_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("expired", response.data['error'])

    def test_verify_email_with_valid_token(self):
        token = VerificationToken.objects.create(
            user=self.test_user,
            purpose='verification',
            expires_at=timezone.now() + datetime.timedelta(hours=24)
        )
        
        payload = {'token': str(token.token)}
        response = self.client.post(self.verify_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify user's email is now verified and token is deleted
        self.test_user.refresh_from_db()
        self.assertTrue(self.test_user.is_email_verified)
        self.assertFalse(VerificationToken.objects.filter(id=token.id).exists())

    def test_resend_verification_email(self):
        self.client.force_authenticate(user=self.test_user)
        mail.outbox = []
        
        response = self.client.post(self.resend_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify new verification token created and email sent
        token = VerificationToken.objects.get(user=self.test_user, purpose='verification')
        self.assertIsNotNone(token)
        self.assertEqual(len(mail.outbox), 1)
