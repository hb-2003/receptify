import json
from rest_framework.test import APITestCase
from rest_framework import status
from receptify.models import Business, User
from customers.models import Customer

class CustomerViewsTestCase(APITestCase):
    
    def setUp(self):
        # Create a test business profile
        self.test_business = Business.objects.create(
            name="Test clinic",
            business_type="Clinic",
            city="Delhi",
            preferred_language="en",
            is_verified=True,
            call_credits=500,
            plan_tier="growth"
        )
        
        # Create an owner account and log them in
        self.test_user = User.objects.create(
            email="test@clinic.in",
            password_hash="SecurePasswordHash",
            owner_name="Dr. Vikram",
            phone="+919876543210",
            role="owner",
            is_email_verified=True,
            business_id=self.test_business.id
        )
        self.client.force_authenticate(user=self.test_user)
        
        self.list_create_url = '/api/customers'
        self.upload_url = '/api/customers/upload'

    def test_manual_customer_creation_formatting(self):
        # Test that standard 10-digit Indian numbers are correctly formatted
        payload = {
            'fullName': 'Aarav Sharma',
            'phone': '9812345001',
            'email': 'aarav@example.com',
            'city': 'Mumbai',
            'language': 'en',
            'customerType': 'patient',
            'dueDate': '15/02/2026' # Indian DD/MM/YYYY format
        }
        
        response = self.client.post(self.list_create_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Check formatted output
        self.assertEqual(response.data['customer']['phone'], '+919812345001')
        self.assertEqual(response.data['customer']['dueDate'], '2026-02-15') # Standard ISO date
        
        # Verify saved object in database
        saved_customer = Customer.objects.get(id=response.data['customer']['id'])
        self.assertEqual(saved_customer.phone, '+919812345001')
        self.assertEqual(str(saved_customer.due_date), '2026-02-15')

    def test_manual_creation_rejects_invalid_phone(self):
        # Rejects non-Indian or improperly sized numbers
        payload = {
            'fullName': 'Invalid Number Customer',
            'phone': '12345',
            'language': 'en'
        }
        response = self.client.post(self.list_create_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid Indian phone number", response.data['error'])

    def test_csv_upload_strips_leading_zero(self):
        # Verifies that leading zero in mobile numbers is auto-cleaned during CSV imports
        payload = {
            'rows': [
                {
                    'fullName': 'Sneha Nair',
                    'phone': '09812345002', # Leading '0'
                    'city': 'Pune',
                    'customerType': 'patient'
                }
            ],
            'dedupe': True
        }
        
        response = self.client.post(self.upload_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['insertedCount'], 1)
        
        # Verify phone was saved in E.164 and leading zero stripped
        saved_customer = Customer.objects.get(full_name='Sneha Nair')
        self.assertEqual(saved_customer.phone, '+919812345002')

    def test_csv_upload_parses_dates_and_languages(self):
        # Verifies regional date formats are parsed and case-insensitive languages mapped
        payload = {
            'rows': [
                {
                    'fullName': 'Rajesh Patel',
                    'phone': '9812345003',
                    'dueDate': '18-02-2026', # DD-MM-YYYY
                    'appointmentDate': '15/02/2026', # DD/MM/YYYY
                    'language': 'HINDI' # Uppercase regional text
                }
            ]
        }
        
        response = self.client.post(self.upload_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        saved_customer = Customer.objects.get(full_name='Rajesh Patel')
        self.assertEqual(str(saved_customer.due_date), '2026-02-18')
        self.assertEqual(str(saved_customer.appointment_date), '2026-02-15')
        self.assertEqual(saved_customer.language, 'en') # System-wide English-only default

    def test_csv_upload_aggregates_custom_fields_json(self):
        # Verifies that unmapped extra CSV columns are saved inside custom_fields JSON
        payload = {
            'rows': [
                {
                    'fullName': 'Kabir Das',
                    'phone': '9812345004',
                    'loanAmount': '₹1,50,000', # Extra unmapped columns
                    'interestRate': '12%',
                    'notes': 'VIP Member'
                }
            ]
        }
        
        response = self.client.post(self.upload_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        saved_customer = Customer.objects.get(full_name='Kabir Das')
        self.assertIsNotNone(saved_customer.custom_fields)
        
        # Decode and inspect metadata dictionary
        metadata = saved_customer.custom_fields
        self.assertEqual(metadata['loanAmount'], '₹1,50,000')
        self.assertEqual(metadata['interestRate'], '12%')
        # Check standard fields were NOT bundled inside custom_fields
        self.assertNotIn('fullName', metadata)
        self.assertNotIn('notes', metadata)

    def test_custom_field_definition_creation(self):
        from customers.models import CustomFieldDefinition
        
        definition = CustomFieldDefinition.objects.create(
            business=self.test_business,
            name='Preferred Room',
            key='preferred_room',
            field_type='TEXT',
            is_required=False,
            options=['Deluxe', 'Standard']
        )
        
        self.assertEqual(definition.name, 'Preferred Room')
        self.assertEqual(definition.key, 'preferred_room')
        self.assertEqual(definition.field_type, 'TEXT')
        self.assertFalse(definition.is_required)
        self.assertEqual(definition.options, ['Deluxe', 'Standard'])

    def test_dynamic_audience_compilation_and_preview(self):
        # Create standard customers with different properties
        Customer.objects.create(
            business=self.test_business,
            full_name="Aman Gupta",
            phone="+919812345011",
            city="Delhi",
            customer_type="patient",
            tags=["VIP", "Regular"],
            custom_fields={"lead_score": "85", "policy_type": "Health"}
        )
        Customer.objects.create(
            business=self.test_business,
            full_name="Bhavesh Patel",
            phone="+919812345012",
            city="Mumbai",
            customer_type="lead",
            tags=["Regular"],
            custom_fields={"lead_score": "45", "policy_type": "Life"}
        )
        Customer.objects.create(
            business=self.test_business,
            full_name="Chitra Sen",
            phone="+919812345013",
            city="Delhi",
            customer_type="patient",
            tags=["VIP"],
            custom_fields={"lead_score": "95", "policy_type": "Health"}
        )

        # 1. Test City Filter
        payload = {
            "filterGroups": [
                {
                    "logic_operator": "AND",
                    "rules": [
                        {"field_name": "city", "operator": "EQUALS", "value": "Delhi"}
                    ]
                }
            ]
        }
        response = self.client.post('/api/customers/audiences/preview', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)
        names = [c['fullName'] for c in response.data['customers']]
        self.assertIn("Aman Gupta", names)
        self.assertIn("Chitra Sen", names)

        # 2. Test Tags Filter (CONTAINS)
        payload = {
            "filterGroups": [
                {
                    "logic_operator": "AND",
                    "rules": [
                        {"field_name": "tags", "operator": "CONTAINS", "value": "VIP"}
                    ]
                }
            ]
        }
        response = self.client.post('/api/customers/audiences/preview', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)

        # 3. Test Custom JSONB Fields (greater than/equals)
        payload = {
            "filterGroups": [
                {
                    "logic_operator": "AND",
                    "rules": [
                        {"field_name": "custom_fields.lead_score", "operator": "GREATER_THAN", "value": "50"}
                    ]
                }
            ]
        }
        response = self.client.post('/api/customers/audiences/preview', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)

