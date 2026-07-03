from django.urls import path
from calls.views import CallListView, CallDetailView

urlpatterns = [
    path('', CallListView.as_view(), name='call_list'),
    path('<uuid:id>', CallDetailView.as_view(), name='call_detail'),
]
