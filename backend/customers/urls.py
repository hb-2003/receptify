from django.urls import path
from customers.views import CustomerListCreateView, CustomerDetailView, CustomerUploadView, AudiencePreviewView

urlpatterns = [
    path('', CustomerListCreateView.as_view(), name='customer_list_create'),
    path('audiences/preview', AudiencePreviewView.as_view(), name='audience_preview'),
    path('<uuid:id>', CustomerDetailView.as_view(), name='customer_detail'),
    path('upload', CustomerUploadView.as_view(), name='customer_upload'),
]
