import datetime
import jwt
import bcrypt
from decouple import config
from django.db import transaction
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from receptify.models import User, Business

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
        email = request.data.get('email', '').strip().lower()
        password = request.data.get('password', '')

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
        email = request.data.get('email', '').strip().lower()
        password = request.data.get('password', '')
        owner_name = request.data.get('ownerName', '').strip()
        business_name = request.data.get('businessName', '').strip()
        phone = request.data.get('phone', '').strip()
        business_type = request.data.get('businessType', '').strip()
        city = request.data.get('city', '').strip()

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
            'planTier': business.plan_tier
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
