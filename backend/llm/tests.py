from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from llm.views import build_fallback_script


class FallbackScriptBuilderTestCase(TestCase):
    """
    Unit tests for the upgraded English-only fallback script builder.
    Verifies variables checklists, objection scenarios, and TRAI compliance blocks.
    """

    def test_default_fallback_generation(self):
        result = build_fallback_script(
            purpose="payment_reminder",
            business_name="Test Clinic",
        )
        self.assertIn("Test Clinic", result["opening"])
        self.assertIn("payment reminder", result["opening"])
        self.assertIn("{{name}}", result["opening"])
        self.assertIn("busy", result["responseHandling"].lower() or "")

    def test_custom_objection_handling_injection(self):
        result = build_fallback_script(
            purpose="payment_reminder",
            business_name="Test Clinic",
            objection_handling="If patients reschedule, offer slots between 10am and 2pm tomorrow"
        )
        self.assertIn("offer slots between 10am and 2pm tomorrow", result["responseHandling"])

    def test_trai_compliance_opt_out_appended(self):
        result = build_fallback_script(
            purpose="payment_reminder",
            business_name="Test Clinic",
            include_opt_out=True
        )
        self.assertIn("TRAI guidelines", result["closing"])
        self.assertIn("press 9 to opt-out", result["closing"])

    def test_dynamic_variables_checklist_conversion(self):
        result = build_fallback_script(
            purpose="payment_reminder",
            business_name="Test Clinic",
            dynamic_variables=["customer_name", "amount_due", "due_date"]
        )
        self.assertIn("[Customer Name]", result["opening"])
        self.assertIn("[Amount Due]", result["mainMessage"])
        self.assertIn("[Due Date]", result["mainMessage"])
        self.assertNotIn("{{name}}", result["opening"])


class GenerateScriptViewTestCase(APITestCase):
    """
    Unit tests for the GenerateScriptView API endpoint.
    """

    def setUp(self):
        self.url = reverse('generate_script_no_slash')

    def test_missing_business_name_fails(self):
        payload = {
            "purpose": "payment_reminder",
            "business_name": ""
        }
        response = self.client.post(self.url, data=payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("business_name is required", response.data["error"])

    def test_successful_fallback_generation_flow(self):
        payload = {
            "purpose": "payment_reminder",
            "business_name": "Hardik Dental",
            "business_type": "clinic",
            "customer_type": "patient",
            "language": "en",
            "tone": "professional",
            "call_goal": "Remind about checkup",
            "objection_handling": "Offer 10am slots",
            "dynamic_variables": ["customer_name", "appointment_date"],
            "include_opt_out": True
        }
        response = self.client.post(self.url, data=payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify custom fields exist in payload response from fallback
        self.assertIn("[Customer Name]", response.data["opening"])
        self.assertIn("[Appointment Date]", response.data["opening"])
        self.assertIn("Offer 10am slots", response.data["responseHandling"])
        self.assertIn("TRAI guidelines", response.data["closing"])
