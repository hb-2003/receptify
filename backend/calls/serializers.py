from rest_framework import serializers
from customers.models import Customer
from campaigns.models import Campaign
from calls.models import Call, CallTranscript, CallRecording

class CustomerMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ['id', 'phone', 'email', 'full_name', 'customer_type']

class CampaignMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Campaign
        fields = ['id', 'name', 'purpose', 'status', 'language']

class CallSerializer(serializers.ModelSerializer):
    customer = CustomerMiniSerializer(read_only=True)
    campaign = CampaignMiniSerializer(read_only=True)

    class Meta:
        model = Call
        fields = '__all__'

class CallTranscriptSerializer(serializers.ModelSerializer):
    class Meta:
        model = CallTranscript
        fields = '__all__'

class CallRecordingSerializer(serializers.ModelSerializer):
    class Meta:
        model = CallRecording
        fields = '__all__'
