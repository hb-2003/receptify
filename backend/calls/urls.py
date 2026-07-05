from django.urls import path
from calls.views import CallListView, CallDetailView
from calls.views_twilio import TwilioCallTwiMLView, TwilioCallStatusView

urlpatterns = [
    path('', CallListView.as_view(), name='call_list'),
    path('<uuid:id>', CallDetailView.as_view(), name='call_detail'),
    path('<uuid:id>/twiml', TwilioCallTwiMLView.as_view(), name='call_twiml'),
    path('<uuid:id>/status', TwilioCallStatusView.as_view(), name='call_status'),
]
