from django.urls import path
from customers.views import CustomerListCreateView, CustomerDetailView, CustomerUploadView

urlpatterns = [
    path('', CustomerListCreateView.as_view(), name='customer_list_create'),
    path('upload', CustomerUploadView.as_view(), name='customer_upload'),
    path('<uuid:id>', CustomerDetailView.as_view(), name='customer_detail'),
]
