import uuid
from django.db import models
from receptify.models import Business

class Customer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phone = models.CharField(max_length=50)
    email = models.EmailField(null=True, blank=True)
    city = models.CharField(max_length=255, null=True, blank=True)
    language = models.CharField(max_length=50, default='en')
    tags = models.TextField(default='')
    notes = models.TextField(null=True, blank=True)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, db_column='business_id')
    full_name = models.CharField(max_length=255)
    customer_type = models.CharField(max_length=255, null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    appointment_date = models.DateField(null=True, blank=True)
    custom_fields = models.JSONField(default=dict, blank=True, null=True)
    consent_status = models.CharField(max_length=50, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'customers'
