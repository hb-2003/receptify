from django.urls import path
from campaigns.views import CampaignListCreateView, CampaignDetailView, CampaignLaunchView, TemplateListCreateView

urlpatterns = [
    path('', CampaignListCreateView.as_view(), name='campaign_list_create'),
    path('templates', TemplateListCreateView.as_view(), name='template_list_create'),
    path('<uuid:id>', CampaignDetailView.as_view(), name='campaign_detail'),
    path('<uuid:id>/launch', CampaignLaunchView.as_view(), name='campaign_launch'),
]
