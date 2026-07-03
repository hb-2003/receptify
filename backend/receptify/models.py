import uuid
from django.db import models

class Business(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    city = models.CharField(max_length=255, null=True, blank=True)
    business_type = models.CharField(max_length=255, null=True, blank=True)
    preferred_language = models.CharField(max_length=50, default='en')
    is_verified = models.BooleanField(default=False)
    call_credits = models.IntegerField(default=100)
    plan_tier = models.CharField(max_length=50, default='starter')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'businesses'


class User(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    role = models.CharField(max_length=50, default='owner')
    password_hash = models.CharField(max_length=255)
    owner_name = models.CharField(max_length=255)
    is_email_verified = models.BooleanField(default=False, db_column='email_verified')
    business = models.ForeignKey(Business, on_delete=models.SET_NULL, null=True, blank=True, db_column='business_id')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_authenticated(self):
        # Always return True for fetched user instances since any unauthenticated requests
        # would have already been rejected by CookieJWTAuthentication.
        return True

    @property
    def is_anonymous(self):
        # Always return False as this represents an identified user account.
        return False

    class Meta:
        db_table = 'users'


class BillingPlan(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    tier = models.CharField(max_length=50)
    features = models.TextField()
    monthly_calls = models.IntegerField()
    monthly_price = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'billing_plans'


class Subscription(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    status = models.CharField(max_length=50, default='active')
    business = models.ForeignKey(Business, on_delete=models.CASCADE, db_column='business_id')
    plan_tier = models.CharField(max_length=50)
    current_period_start = models.DateTimeField()
    current_period_end = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'subscriptions'


class TwilioCredentials(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.OneToOneField(Business, on_delete=models.CASCADE, db_column='business_id')
    account_sid = models.CharField(max_length=255)
    auth_token = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=50, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'twilio_credentials'


class UsageLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    action = models.CharField(max_length=255)
    credits = models.IntegerField(default=1)
    metadata = models.JSONField(null=True, blank=True)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, db_column='business_id')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'usage_logs'
