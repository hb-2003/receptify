import datetime
import jwt
import bcrypt
import uuid
from decouple import config
from django.db import transaction
from django.utils import timezone
import json
import urllib.request
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from receptify.models import User, Business, VerificationToken

# Helper to send emails directly via Resend's REST API
def send_resend_email_api(to_email, subject, message):
    # Safe fallback if API Key is missing for local sandboxed testing
    if not settings.RESEND_API_KEY:
        print(f"--- [MOCK EMAIL SENT] ---\nTo: {to_email}\nSubject: {subject}\nMessage: {message}\n------------------------")
        return True

    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {settings.RESEND_API_KEY}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0"
    }
    payload = {
        "from": settings.DEFAULT_FROM_EMAIL,
        "to": [to_email],
        "subject": subject,
        "text": message
    }
    
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers=headers,
            method='POST'
        )
        # Enforce a strict 5-second connection timeout to keep auth responses fast
        with urllib.request.urlopen(req, timeout=5.0) as resp:
            return resp.status == 200 or resp.status == 201
    except Exception as e:
        print(f"Resend REST API dispatch failed: {str(e)}")
        return False


# Helper to send verification email
def send_verification_email(user):
    # Expire old verification tokens
    VerificationToken.objects.filter(user=user, purpose='verification').delete()
    
    # Create new verification token (valid for 24 hours)
    token = VerificationToken.objects.create(
        user=user,
        purpose='verification',
        expires_at=timezone.now() + datetime.timedelta(hours=24)
    )
    
    link = f"{settings.FRONTEND_URL}/verify-email?token={token.token}"
    subject = "Verify your Receptify account"
    message = (
        f"Hello {user.owner_name},\n\n"
        f"Thank you for signing up for Receptify! Please verify your email by clicking the link below:\n"
        f"{link}\n\n"
        f"This link is valid for 24 hours.\n\n"
        f"Best regards,\n"
        f"The Receptify Team"
    )
    
    send_resend_email_api(user.email, subject, message)


# Helper to send password reset email
def send_reset_email(user):
    # Expire old reset tokens
    VerificationToken.objects.filter(user=user, purpose='reset').delete()
    
    # Create new reset token (valid for 1 hour)
    token = VerificationToken.objects.create(
        user=user,
        purpose='reset',
        expires_at=timezone.now() + datetime.timedelta(hours=1)
    )
    
    link = f"{settings.FRONTEND_URL}/reset-password?token={token.token}"
    subject = "Reset your Receptify password"
    message = (
        f"Hello {user.owner_name},\n\n"
        f"We received a request to reset your password. Please click the link below to set a new password:\n"
        f"{link}\n\n"
        f"This link is valid for 1 hour. If you did not request this, you can safely ignore this email.\n\n"
        f"Best regards,\n"
        f"The Receptify Team"
    )
    
    send_resend_email_api(user.email, subject, message)


# Helper to generate JWT Token
def generate_jwt_token(user):
    secret = config('JWT_SECRET', default='change_me')
    payload = {
        'userId': str(user.id),
        'email': user.email,
        'businessId': str(user.business_id) if user.business_id else None,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }
    return jwt.encode(payload, secret, algorithm='HS256')


# Helper to attach auth cookie to response
def set_auth_cookie(response, token):
    response.set_cookie(
        'receptify_token',
        token,
        max_age=7 * 24 * 60 * 60,  # 7 days in seconds
        path='/',
        domain=None,
        secure=True,
        httponly=True,
        samesite='Lax'
    )


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email_raw = request.data.get('email', '') or ''
        email = email_raw.strip().lower()
        password = request.data.get('password', '') or ''

        if not email or not password:
            return Response({'error': 'Email and password are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'error': 'Invalid email or password'}, status=status.HTTP_401_UNAUTHORIZED)

        # Verify password using bcrypt
        password_bytes = password.encode('utf-8')
        hash_bytes = user.password_hash.encode('utf-8')
        if not bcrypt.checkpw(password_bytes, hash_bytes):
            return Response({'error': 'Invalid email or password'}, status=status.HTTP_401_UNAUTHORIZED)

        # Get business info
        business = user.business

        # Generate Token
        token = generate_jwt_token(user)

        # Build Response
        user_data = {'id': str(user.id), 'email': user.email, 'ownerName': user.owner_name}
        business_data = {
            'id': str(business.id),
            'name': business.name,
            'callCredits': business.call_credits,
            'planTier': business.plan_tier
        } if business else None

        res_data = {
            'user': user_data,
            'business': business_data
        }
        
        response = Response(res_data, status=status.HTTP_200_OK)
        set_auth_cookie(response, token)
        return response


class SignupView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        password = request.data.get('password') or ''
        owner_name = (request.data.get('ownerName') or '').strip()
        business_name = (request.data.get('businessName') or '').strip()
        phone = (request.data.get('phone') or '').strip()
        business_type = (request.data.get('businessType') or '').strip()
        city = (request.data.get('city') or '').strip()

        if not email or not password or not owner_name or not business_name:
            return Response({'error': 'Missing required fields'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email=email).exists():
            return Response({'error': 'Email already registered'}, status=status.HTTP_400_BAD_REQUEST)

        # Hash password using bcrypt
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(10)).decode('utf-8')

        try:
            with transaction.atomic():
                # 1. Create Business
                business = Business.objects.create(
                    name=business_name,
                    city=city if city else None,
                    business_type=business_type if business_type else None,
                    preferred_language='en',
                    is_verified=False,
                    call_credits=100,
                    plan_tier='starter'
                )

                # 2. Create User
                user = User.objects.create(
                    email=email,
                    password_hash=hashed_password,
                    owner_name=owner_name,
                    phone=phone if phone else None,
                    role='owner',
                    is_email_verified=False,
                    business=business
                )

            # Generate Token
            token = generate_jwt_token(user)

            # Send verification email after transaction commits (gracefully handle email service failures)
            try:
                send_verification_email(user)
            except Exception:
                pass

            # Build Response
            user_data = {'id': str(user.id), 'email': user.email, 'ownerName': user.owner_name}
            business_data = {
                'id': str(business.id),
                'name': business.name,
                'callCredits': business.call_credits,
                'planTier': business.plan_tier
            }

            res_data = {
                'user': user_data,
                'business': business_data
            }

            response = Response(res_data, status=status.HTTP_201_CREATED)
            set_auth_cookie(response, token)
            return response

        except Exception as e:
            return Response({'error': f'Signup failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class MeView(APIView):
    def get(self, request):
        user = request.user
        business = user.business

        user_data = {'id': str(user.id), 'email': user.email, 'ownerName': user.owner_name}
        business_data = {
            'id': str(business.id),
            'name': business.name,
            'callCredits': business.call_credits,
            'planTier': business.plan_tier,
            'onboardingDismissed': business.is_onboarding_dismissed
        } if business else None

        return Response({
            'user': user_data,
            'business': business_data
        }, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        response = Response({'success': True}, status=status.HTTP_200_OK)
        response.delete_cookie('receptify_token', path='/')
        return response


class DismissOnboardingView(APIView):
    def post(self, request):
        user = request.user
        business = user.business
        if not business:
            return Response({'error': 'No business profile found'}, status=status.HTTP_400_BAD_REQUEST)
        
        business.is_onboarding_dismissed = True
        business.save()
        return Response({'success': True, 'onboardingDismissed': True}, status=status.HTTP_200_OK)


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = User.objects.get(email=email)
            try:
                send_reset_email(user)
            except Exception:
                # Catch any SMTP exceptions so account enumeration is fully blocked
                pass
        except User.DoesNotExist:
            # Secure design: do not disclose if email is registered
            pass
            
        return Response({
            'success': True, 
            'message': 'If an account exists for that email, reset instructions have been sent.'
        }, status=status.HTTP_200_OK)


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token_str = (request.data.get('token') or '').strip()
        new_password = request.data.get('password') or ''

        if not token_str or not new_password:
            return Response({'error': 'Token and password are required'}, status=status.HTTP_400_BAD_REQUEST)

        # Basic password strength enforcement
        if len(new_password) < 8:
            return Response({'error': 'Password must be at least 8 characters long.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            token_uuid = uuid.UUID(token_str)
            token_obj = VerificationToken.objects.get(token=token_uuid, purpose='reset')
        except (ValueError, VerificationToken.DoesNotExist):
            return Response({'error': 'Invalid or expired password reset token'}, status=status.HTTP_400_BAD_REQUEST)

        if token_obj.expires_at < timezone.now():
            token_obj.delete()
            return Response({'error': 'Password reset token has expired'}, status=status.HTTP_400_BAD_REQUEST)

        user = token_obj.user
        hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt(10)).decode('utf-8')
        user.password_hash = hashed_password
        user.save()

        # Delete token as it's been used
        token_obj.delete()

        return Response({'success': True, 'message': 'Password has been successfully updated.'}, status=status.HTTP_200_OK)


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token_str = (request.data.get('token') or '').strip()
        if not token_str:
            return Response({'error': 'Token is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            token_uuid = uuid.UUID(token_str)
            token_obj = VerificationToken.objects.get(token=token_uuid, purpose='verification')
        except (ValueError, VerificationToken.DoesNotExist):
            return Response({'error': 'Invalid or expired verification token'}, status=status.HTTP_400_BAD_REQUEST)

        if token_obj.expires_at < timezone.now():
            token_obj.delete()
            return Response({'error': 'Verification token has expired'}, status=status.HTTP_400_BAD_REQUEST)

        user = token_obj.user
        user.is_email_verified = True
        user.save()

        # Delete token as it's been used
        token_obj.delete()

        return Response({'success': True, 'message': 'Email has been successfully verified.'}, status=status.HTTP_200_OK)


class ResendVerificationView(APIView):
    def post(self, request):
        user = request.user
        if user.is_email_verified:
            return Response({'error': 'Email is already verified'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            send_verification_email(user)
            return Response({'success': True, 'message': 'Verification email has been resent.'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': f'Failed to send verification email: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
