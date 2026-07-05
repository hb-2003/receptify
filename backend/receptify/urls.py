from django.urls import path, include
from receptify.views_auth import (
    LoginView, SignupView, MeView, LogoutView, DismissOnboardingView,
    ForgotPasswordView, ResetPasswordView, VerifyEmailView, ResendVerificationView
)
from receptify.views_analytics import AnalyticsView
from receptify.views_twilio import TwilioCredentialsView

# Import views from modular apps to support direct non-slashed routing
from customers.views import CustomerListCreateView
from campaigns.views import CampaignListCreateView, TemplateListCreateView
from calls.views import CallListView
from calls.views_twilio import TwilioTwiMLView
from llm.views import GenerateScriptView

urlpatterns = [
    # Authentication Endpoints
    path('api/auth/login', LoginView.as_view(), name='auth_login'),
    path('api/auth/signup', SignupView.as_view(), name='auth_signup'),
    path('api/auth/me', MeView.as_view(), name='auth_me'),
    path('api/auth/logout', LogoutView.as_view(), name='auth_logout'),
    path('api/auth/onboarding/dismiss', DismissOnboardingView.as_view(), name='dismiss_onboarding'),
    path('api/auth/forgot-password', ForgotPasswordView.as_view(), name='auth_forgot_password'),
    path('api/auth/reset-password', ResetPasswordView.as_view(), name='auth_reset_password'),
    path('api/auth/verify-email', VerifyEmailView.as_view(), name='auth_verify_email'),
    path('api/auth/resend-verification', ResendVerificationView.as_view(), name='auth_resend_verification'),
    
    # Analytics Endpoint
    path('api/analytics', AnalyticsView.as_view(), name='analytics'),
    
    # Twilio Integration Endpoint
    path('api/v1/business/twilio', TwilioCredentialsView.as_view(), name='business_twilio'),
    path('api/v1/voice/twiml', TwilioTwiMLView.as_view(), name='twiml_endpoint'),
    
    # Backward compatible endpoints
    path('api/v1/auth/login', LoginView.as_view(), name='auth_login_v1'),

    # Direct routes to match trailing-slash-free frontend fetch requests exactly.
    # This prevents POST request body loss during Django's automatic APPEND_SLASH redirects.
    path('api/customers', CustomerListCreateView.as_view(), name='customer_list_create_no_slash'),
    path('api/campaigns', CampaignListCreateView.as_view(), name='campaign_list_create_no_slash'),
    path('api/calls', CallListView.as_view(), name='call_list_no_slash'),
    
    # Direct mappings for pre-built templates and AI script generation endpoints.
    # This aligns Django REST framework views with the exact Next.js client-side paths.
    path('api/templates', TemplateListCreateView.as_view(), name='templates_no_slash'),
    path('api/scripts/generate', GenerateScriptView.as_view(), name='generate_script_no_slash'),

    # Modular App Endpoints
    path('api/customers/', include('customers.urls')),
    path('api/campaigns/', include('campaigns.urls')),
    path('api/calls/', include('calls.urls')),
    path('api/llm/', include('llm.urls')),
]
