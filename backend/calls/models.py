import uuid
from django.db import models
from campaigns.models import Campaign
from customers.models import Customer

class Call(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    status = models.CharField(max_length=50, default='queued')
    outcome = models.CharField(max_length=50, default='pending')
    notes = models.TextField(null=True, blank=True)
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, db_column='campaign_id')
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, db_column='customer_id')
    duration_sec = models.IntegerField(default=0)
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    attempt_number = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    channel_type = models.IntegerField(default=0)

    class Meta:
        db_table = 'calls'


class CallEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    call = models.ForeignKey(Call, on_delete=models.CASCADE, db_column='call_id')
    event_type = models.CharField(max_length=255)
    payload = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'call_events'


class CallRecording(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    call = models.OneToOneField(Call, on_delete=models.CASCADE, db_column='call_id')
    audio_url = models.TextField(default='/audio/sample-recording.wav')
    duration_sec = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'call_recordings'


class CallTranscript(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    text = models.TextField()
    summary = models.TextField(null=True, blank=True)
    call = models.OneToOneField(Call, on_delete=models.CASCADE, db_column='call_id')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'call_transcripts'
