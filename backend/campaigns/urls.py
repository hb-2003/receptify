from django.urls import path
from campaigns.views import (
    CampaignListCreateView,
    CampaignDetailView,
    CampaignLaunchView,
    TemplateListCreateView,
    CampaignPauseView,
    CampaignResumeView,
    CampaignCancelView,
    CampaignDuplicateView,
)

urlpatterns = [
    path('', CampaignListCreateView.as_view(), name='campaign_list_create'),
    path('templates', TemplateListCreateView.as_view(), name='template_list_create'),
    path('<uuid:id>', CampaignDetailView.as_view(), name='campaign_detail'),
    path('<uuid:id>/launch', CampaignLaunchView.as_view(), name='campaign_launch'),
    path('<uuid:id>/pause', CampaignPauseView.as_view(), name='campaign_pause'),
    path('<uuid:id>/resume', CampaignResumeView.as_view(), name='campaign_resume'),
    path('<uuid:id>/cancel', CampaignCancelView.as_view(), name='campaign_cancel'),
    path('<uuid:id>/duplicate', CampaignDuplicateView.as_view(), name='campaign_duplicate'),
]
