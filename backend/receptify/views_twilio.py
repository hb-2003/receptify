import base64
import httpx
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from receptify.models import TwilioCredentials
from receptify.crypto import encrypt, decrypt


class TwilioCredentialsView(APIView):
    def get(self, request):
        user = request.user
        if not user.business_id:
            return Response({'error': 'No associated business found for this account'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            credentials = TwilioCredentials.objects.get(business_id=user.business_id)
            return Response({
                'accountSid': credentials.account_sid,
                'phoneNumber': credentials.phone_number or '',
                'hasAuthToken': True
            }, status=status.HTTP_200_OK)
        except TwilioCredentials.DoesNotExist:
            return Response({
                'accountSid': '',
                'phoneNumber': '',
                'hasAuthToken': False
            }, status=status.HTTP_200_OK)

    def post(self, request):
        user = request.user
        if not user.business_id:
            return Response({'error': 'No associated business found for this account'}, status=status.HTTP_400_BAD_REQUEST)

        account_sid = request.data.get('accountSid', '').strip()
        auth_token = request.data.get('authToken', '').strip()
        phone_number = request.data.get('phoneNumber', '').strip()

        if not account_sid or not auth_token:
            return Response({'error': 'Account SID and Auth Token are required'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate with the live Twilio API
        # Auth header base64 encode
        auth_str = f"{account_sid}:{auth_token}"
        auth_b64 = base64.b64encode(auth_str.encode('utf-8')).decode('utf-8')
        authorization_header = f"Basic {auth_b64}"
        twilio_url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}.json"

        try:
            with httpx.Client() as client:
                response = client.get(twilio_url, headers={'Authorization': authorization_header})
                
                if response.status_code != 200:
                    print(f"Twilio validation error: {response.text}")
                    return Response(
                        {'error': 'Failed to validate Twilio account credentials. Please check your Account SID and Auth Token.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
        except Exception as e:
            print(f"Network error validating with Twilio API: {str(e)}")
            return Response(
                {'error': f'Could not connect to Twilio API for verification: {str(e)}'},
                status=status.HTTP_502_BAD_GATEWAY
            )

        # Encrypt auth token before saving
        encrypted_token = encrypt(auth_token)

        try:
            credentials, created = TwilioCredentials.objects.update_or_create(
                business_id=user.business_id,
                defaults={
                    'account_sid': account_sid,
                    'auth_token': encrypted_token,
                    'phone_number': phone_number if phone_number else None
                }
            )
            return Response({
                'accountSid': credentials.account_sid,
                'phoneNumber': credentials.phone_number or '',
                'hasAuthToken': True
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': f'Save failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
