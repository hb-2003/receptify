import uuid
from django.db import models
from receptify.models import Business
from customers.models import Customer

class Campaign(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    purpose = models.CharField(max_length=255, default='custom')
    status = models.CharField(max_length=50, default='draft')
    language = models.CharField(max_length=50, default='en')
    business = models.ForeignKey(Business, on_delete=models.CASCADE, db_column='business_id')
    voice_type = models.CharField(max_length=100, default='female_professional')
    scheduled_at = models.DateTimeField(null=True, blank=True)
    calling_window_start = models.CharField(max_length=10, default='09:00')
    calling_window_end = models.CharField(max_length=10, default='19:00')
    retry_attempts = models.IntegerField(default=2)
    delay_between_calls = models.IntegerField(default=5)
    script_text = models.TextField(null=True, blank=True)
    is_compliance_confirmed = models.BooleanField(default=False, db_column='compliance_confirmed')
    total_contacts = models.IntegerField(default=0)
    calls_completed = models.IntegerField(default=0)
    calls_answered = models.IntegerField(default=0)
    calls_failed = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    channel_type = models.IntegerField(default=0)

    class Meta:
        db_table = 'campaigns'


class CampaignCustomer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, db_column='campaign_id')
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, db_column='customer_id')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'campaign_customers'
        unique_together = ('campaign', 'customer')


class Script(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    purpose = models.CharField(max_length=255, default='custom')
    language = models.CharField(max_length=50, default='en')
    body = models.TextField()
    tone = models.CharField(max_length=100, default='professional')
    business = models.ForeignKey(Business, on_delete=models.CASCADE, db_column='business_id')
    short_version = models.TextField(null=True, blank=True)
    polite_version = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'scripts'


class Template(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    industry = models.CharField(max_length=255)
    purpose = models.CharField(max_length=255)
    language = models.CharField(max_length=50, default='en')
    preview = models.TextField()
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'templates'


class CampaignFilterGroup(models.Model):
    """
    Groups a list of dynamic target criteria together under a logical operator.
    Enables grouping rules inside AND or OR cards.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='filter_groups', db_column='campaign_id')
    logic_operator = models.CharField(max_length=10, choices=[('AND', 'AND'), ('OR', 'OR')], default='AND', db_column='logic_operator')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'campaign_filter_groups'


class CampaignFilterRule(models.Model):
    """
    Declares an individual field filter rule (e.g. City = Mumbai).
    Natively supports both core fields and custom dynamic JSON keys.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(CampaignFilterGroup, on_delete=models.CASCADE, related_name='rules', db_column='group_id')
    field_name = models.CharField(max_length=100, db_column='field_name')  # e.g., 'city', 'due_date', or 'custom_fields.lead_score'
    operator = models.CharField(max_length=50, db_column='operator')      # e.g., 'EQUALS', 'IN', 'GREATER_THAN', 'BETWEEN'
    value = models.JSONField(db_column='value')                            # Stored value structures (supports arrays or primitives)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'campaign_filter_rules'
