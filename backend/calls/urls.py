from django.urls import path
from calls.views import CallListView, CallDetailView, TestCallView
from calls.views_twilio import TwilioCallTwiMLView, TwilioCallStatusView, CallAudioView, TwilioCallRecordingView

urlpatterns = [
    path('', CallListView.as_view(), name='call_list'),
    path('test-call', TestCallView.as_view(), name='test_call'),
    path('<uuid:id>', CallDetailView.as_view(), name='call_detail'),
    path('<uuid:id>/twiml', TwilioCallTwiMLView.as_view(), name='call_twiml'),
    path('<uuid:id>/status', TwilioCallStatusView.as_view(), name='call_status'),
    path('<uuid:id>/audio', CallAudioView.as_view(), name='call_audio'),
    path('<uuid:id>/recording', TwilioCallRecordingView.as_view(), name='call_recording'),
]
