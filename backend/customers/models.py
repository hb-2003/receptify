import uuid

from django.db import models
from django.contrib.postgres.fields import ArrayField
from django.contrib.postgres.indexes import GinIndex

from receptify.models import Business


class CustomFieldDefinition(models.Model):
    FIELD_TYPE_CHOICES = [
        ('TEXT', 'Text'),
        ('NUMBER', 'Number'),
        ('BOOLEAN', 'Boolean'),
        ('DATE', 'Date'),
        ('DROPDOWN', 'Dropdown'),
        ('MULTI_SELECT', 'Multi-select'),
        ('CURRENCY', 'Currency'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, db_column='business_id')
    name = models.CharField(max_length=255)
    key = models.CharField(max_length=100)
    field_type = models.CharField(max_length=50, choices=FIELD_TYPE_CHOICES, db_column='field_type')
    is_required = models.BooleanField(default=False, db_column='is_required')
    options = models.JSONField(default=list, blank=True, null=True)
    group_name = models.CharField(max_length=100, blank=True, null=True, db_column='group_name')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'custom_field_definitions'
        unique_together = ('business', 'key')


class Customer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phone = models.CharField(max_length=50)
    email = models.EmailField(null=True, blank=True)
    city = models.CharField(max_length=255, null=True, blank=True)
    language = models.CharField(max_length=50, default='en')
    tags = ArrayField(models.CharField(max_length=100), default=list, blank=True)
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
        indexes = [
            GinIndex(fields=['custom_fields'], name='customers_custom_fields_gin', opclasses=['jsonb_path_ops']),
            GinIndex(fields=['tags'], name='customers_tags_gin'),
        ]

