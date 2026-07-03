from django.urls import path
from llm.views import GenerateScriptView

urlpatterns = [
    path('generate-script', GenerateScriptView.as_view(), name='llm_generate_script'),
]
