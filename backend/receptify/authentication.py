import jwt
from decouple import config
from rest_framework import authentication
from rest_framework import exceptions
from receptify.models import User

class CookieJWTAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        # 1. Retrieve the token from the HttpOnly cookie
        token = request.COOKIES.get('receptify_token')
        
        # 2. Fallback to Authorization: Bearer <token> for easy API testing
        if not token:
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
            else:
                return None

        # 3. Decode and verify the JWT
        try:
            secret = config('JWT_SECRET', default='change_me')
            payload = jwt.decode(token, secret, algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            raise exceptions.AuthenticationFailed('Token has expired')
        except jwt.InvalidTokenError:
            raise exceptions.AuthenticationFailed('Invalid token')

        # 4. Fetch the associated User
        user_id = payload.get('userId')
        if not user_id:
            raise exceptions.AuthenticationFailed('Invalid token payload')

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise exceptions.AuthenticationFailed('User does not exist')

        return (user, token)
