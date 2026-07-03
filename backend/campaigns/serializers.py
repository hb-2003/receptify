from rest_framework import serializers
from campaigns.models import Campaign, Template, Script

class CampaignSerializer(serializers.ModelSerializer):
    class Meta:
        model = Campaign
        fields = '__all__'

class TemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Template
        fields = '__all__'

class ScriptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Script
        fields = '__all__'
