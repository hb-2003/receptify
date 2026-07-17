from rest_framework import serializers
from customers.models import Customer

class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = [
            'id', 'phone', 'email', 'city', 'language', 'tags', 'notes', 
            'business', 'full_name', 'customer_type', 'due_date', 
            'appointment_date', 'custom_fields', 'consent_status', 
            'created_at', 'updated_at'
        ]
