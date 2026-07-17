from rest_framework import serializers
from campaigns.models import Campaign, Template, Script

class CampaignSerializer(serializers.ModelSerializer):
    class Meta:
        model = Campaign
        fields = [
            'id', 'name', 'purpose', 'status', 'language', 'business', 
            'voice_type', 'scheduled_at', 'calling_window_start', 'calling_window_end', 
            'retry_attempts', 'delay_between_calls', 'script_text', 'is_compliance_confirmed', 
            'total_contacts', 'calls_completed', 'calls_answered', 'calls_failed', 
            'created_at', 'updated_at', 'channel_type'
        ]

class TemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Template
        fields = ['id', 'name', 'industry', 'purpose', 'language', 'preview', 'body', 'created_at']

class ScriptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Script
        fields = ['id', 'name', 'purpose', 'language', 'body', 'tone', 'business', 'short_version', 'polite_version', 'created_at']
