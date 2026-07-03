import re
import csv
from django.db import transaction
from django.http import HttpResponse
from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from customers.models import Customer
from customers.serializers import CustomerSerializer

# Helpers for Indian Phone Formatting and Validation
def format_phone(phone: str) -> str:
    digits = re.sub(r'\D', '', phone)
    if len(digits) == 10:
        return f'+91{digits}'
    if len(digits) == 12 and digits.startswith('91'):
        return f'+{digits}'
    if phone.startswith('+'):
        return phone
    return f'+{digits}'

def is_valid_indian_phone(phone: str) -> bool:
    digits = re.sub(r'\D', '', phone)
    if len(digits) == 10:
        return bool(re.match(r'^[6-9]', digits))
    if len(digits) == 12 and digits.startswith('91'):
        return bool(re.match(r'^91[6-9]', digits))
    return False


class CustomerListCreateView(APIView):
    def get(self, request):
        user = request.user
        if not user.business_id:
            return Response({'customers': [], 'total': 0}, status=status.HTTP_200_OK)

        q = request.query_params.get('q', '').strip()
        tag = request.query_params.get('tag', '').strip()

        queryset = Customer.objects.filter(business_id=user.business_id)

        if q:
            queryset = queryset.filter(
                Q(full_name__icontains=q) |
                Q(phone__icontains=q) |
                Q(city__icontains=q)
            )

        if tag:
            queryset = queryset.filter(tags__icontains=tag)

        queryset = queryset.order_by('-created_at')[:500]
        
        serializer = CustomerSerializer(queryset, many=True)
        # Note: Frontend expects camelCase keys inside JSON.
        # But our django fields match the database exactly (which has snake_case)!
        # Wait, does the frontend expect camelCase keys inside Customer JSON?
        # Let's check how the frontend renders Customer properties (e.g. customer.fullName, customer.customerType).
        # Ah! In TypeScript/Next.js, they map to camelCase (customer.fullName, etc.).
        # In Django, DRF serialize fields default to matching model properties (which are snake_case: full_name, customer_type!).
        # To bridge this gap, we can write a clean helper to serialize keys into camelCase, OR customize the Serializer!
        # Yes! Writing a clean helper to recursively convert dictionary keys to camelCase is incredibly robust,
        # and guarantees that the frontend receives exactly what it expects!
        return Response({
            'customers': [to_camel_case(c) for c in serializer.data],
            'total': len(serializer.data)
        }, status=status.HTTP_200_OK)

    def post(self, request):
        user = request.user
        if not user.business_id:
            return Response({'error': 'No business associated with user'}, status=status.HTTP_400_BAD_REQUEST)

        # Parse request body (expected camelCase)
        full_name = request.data.get('fullName', '').strip()
        raw_phone = request.data.get('phone', '').strip()
        email = request.data.get('email', '').strip()
        city = request.data.get('city', '').strip()
        language = request.data.get('language', 'en').strip()
        customer_type = request.data.get('customerType', '').strip()
        tags = request.data.get('tags', [])
        due_date = request.data.get('dueDate')
        appointment_date = request.data.get('appointmentDate')
        notes = request.data.get('notes', '').strip()
        consent_status = request.data.get('consentStatus', 'granted').strip()

        if not full_name or not raw_phone:
            return Response({'error': 'Missing name or phone'}, status=status.HTTP_400_BAD_REQUEST)

        phone = format_phone(raw_phone)
        if not is_valid_indian_phone(phone):
            return Response({'error': 'Invalid Indian phone number'}, status=status.HTTP_400_BAD_REQUEST)

        # Build tags as string (Next.js tags are string/text in DB: "tags: text")
        # In TypeORM: tags was a text field defaulting to ''
        tags_str = ','.join(tags) if isinstance(tags, list) else str(tags)

        try:
            customer = Customer.objects.create(
                business_id=user.business_id,
                full_name=full_name,
                phone=phone,
                email=email if email else None,
                city=city if city else None,
                language=language if language in ['en', 'hi', 'gu'] else 'en',
                customer_type=customer_type if customer_type else None,
                tags=tags_str,
                due_date=due_date if due_date else None,
                appointment_date=appointment_date if appointment_date else None,
                notes=notes if notes else None,
                consent_status=consent_status,
                custom_fields=None
            )

            serializer = CustomerSerializer(customer)
            return Response({'customer': to_camel_case(serializer.data)}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CustomerDetailView(APIView):
    def get(self, request, id):
        user = request.user
        try:
            customer = Customer.objects.get(id=id, business_id=user.business_id)
        except Customer.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = CustomerSerializer(customer)
        return Response({'customer': to_camel_case(serializer.data)}, status=status.HTTP_200_OK)

    def patch(self, request, id):
        user = request.user
        try:
            customer = Customer.objects.get(id=id, business_id=user.business_id)
        except Customer.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        # Map incoming camelCase updates to model snake_case attributes
        data_mappings = {
            'fullName': 'full_name',
            'phone': 'phone',
            'email': 'email',
            'city': 'city',
            'language': 'language',
            'customerType': 'customer_type',
            'notes': 'notes',
            'dueDate': 'due_date',
            'appointmentDate': 'appointment_date',
            'consentStatus': 'consent_status'
        }

        for camel_k, snake_k in data_mappings.items():
            if camel_k in request.data:
                val = request.data.get(camel_k)
                if camel_k == 'phone':
                    val = format_phone(str(val))
                    if not is_valid_indian_phone(val):
                        return Response({'error': 'Invalid Indian phone number'}, status=status.HTTP_400_BAD_REQUEST)
                setattr(customer, snake_k, val if val != '' else None)

        if 'tags' in request.data:
            tags = request.data.get('tags')
            customer.tags = ','.join(tags) if isinstance(tags, list) else str(tags)

        customer.save()
        serializer = CustomerSerializer(customer)
        return Response({'customer': to_camel_case(serializer.data)}, status=status.HTTP_200_OK)

    def delete(self, request, id):
        user = request.user
        try:
            customer = Customer.objects.get(id=id, business_id=user.business_id)
            customer.delete()
            return Response({'ok': True}, status=status.HTTP_200_OK)
        except Customer.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


class CustomerUploadView(APIView):
    def get(self, request):
        # Return sample CSV for downlaod
        sample = (
            "fullName,phone,email,city,language,customerType,notes,dueDate,appointmentDate\n"
            "Priya Patel,9812345001,priya@example.com,Mumbai,en,patient,Annual checkup due,,2026-02-15\n"
            "Rohan Mehta,9812345002,,Pune,hi,patient,Diabetes follow-up,,2026-02-18\n"
            "Sneha Iyer,9812345003,sneha@example.com,Bengaluru,en,lead,Enquired about lab tests,,\n"
        )
        response = HttpResponse(sample, content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="receptify-sample-customers.csv"'
        return response

    def post(self, request):
        user = request.user
        if not user.business_id:
            return Response({'error': 'No business associated with user'}, status=status.HTTP_400_BAD_REQUEST)

        rows = request.data.get('rows', [])
        dedupe = request.data.get('dedupe', True)

        if not isinstance(rows, list):
            return Response({'error': 'rows must be a list'}, status=status.HTTP_400_BAD_REQUEST)

        # Get existing phone numbers for deduplication
        existing_phones = set(Customer.objects.filter(business_id=user.business_id).values_list('phone', flat=True))

        inserted_count = 0
        duplicates = []
        invalid = []
        customers_to_create = []

        for row in rows:
            full_name = row.get('fullName', '').strip()
            raw_phone = str(row.get('phone', '')).strip()

            if not full_name or not raw_phone:
                invalid.append({'row': row, 'reason': 'Missing name or phone'})
                continue

            phone = format_phone(raw_phone)
            if not is_valid_indian_phone(phone):
                invalid.append({'row': row, 'reason': 'Invalid Indian phone'})
                continue

            if dedupe and phone in existing_phones:
                duplicates.append(row)
                continue

            email = str(row.get('email', '')).strip()
            city = str(row.get('city', '')).strip()
            language = str(row.get('language', 'en')).strip()
            customer_type = str(row.get('customerType', '')).strip()
            notes = str(row.get('notes', '')).strip()
            due_date = row.get('dueDate')
            appointment_date = row.get('appointmentDate')

            # Handle tag formatting matching Next.js logic
            tags = [customer_type] if customer_type else []
            tags_str = ','.join(tags)

            customers_to_create.append(
                Customer(
                    business_id=user.business_id,
                    full_name=full_name,
                    phone=phone,
                    email=email if email else None,
                    city=city if city else None,
                    language=language if language in ['en', 'hi', 'gu'] else 'en',
                    customer_type=customer_type if customer_type else None,
                    tags=tags_str,
                    notes=notes if notes else None,
                    due_date=due_date if due_date else None,
                    appointment_date=appointment_date if appointment_date else None,
                    consent_status='granted'
                )
            )
            # Add to set so rows inside the same file don't double import
            existing_phones.add(phone)

        # Bulk save
        if customers_to_create:
            with transaction.atomic():
                Customer.objects.bulk_create(customers_to_create)
                inserted_count = len(customers_to_create)

        return Response({
            'insertedCount': inserted_count,
            'duplicatesCount': len(duplicates),
            'invalidCount': len(invalid),
            'duplicates': duplicates,
            'invalid': invalid
        }, status=status.HTTP_200_OK)


# Helper to convert snake_case keys in dictionary to camelCase for the frontend
def to_camel_case(data):
    if isinstance(data, list):
        return [to_camel_case(i) for i in data]
    elif isinstance(data, dict):
        new_dict = {}
        for k, v in data.items():
            # Convert snake_case to camelCase
            parts = k.split('_')
            camel_key = parts[0] + ''.join(x.title() for x in parts[1:])
            new_dict[camel_key] = to_camel_case(v)
        return new_dict
    else:
        return data
