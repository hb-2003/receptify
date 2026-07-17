import re
import csv
import json
from datetime import datetime
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
    # Strip leading zero from 11-digit numbers (common Indian entry style)
    if len(digits) == 11 and digits.startswith('0'):
        digits = digits[1:]
        
    if len(digits) == 10:
        return f'+91{digits}'
    if len(digits) == 12 and digits.startswith('91'):
        return f'+{digits}'
    if phone.startswith('+'):
        return phone
    return f'+{digits}'

def is_valid_indian_phone(phone: str) -> bool:
    digits = re.sub(r'\D', '', phone)
    # Strip leading zero from 11-digit numbers
    if len(digits) == 11 and digits.startswith('0'):
        digits = digits[1:]
        
    if len(digits) == 10:
        return bool(re.match(r'^[6-9]', digits))
    if len(digits) == 12 and digits.startswith('91'):
        return bool(re.match(r'^91[6-9]', digits))
    return False

def parse_date_string(date_str):
    if not date_str:
        return None
    date_str = str(date_str).strip()
    if not date_str or date_str.lower() in ['none', 'null', 'undefined', '']:
        return None
        
    formats = [
        '%Y-%m-%d',  # ISO: 2026-02-15
        '%d/%m/%Y',  # Indian standard: 15/02/2026
        '%d-%m-%Y',  # Indian alternative: 15-02-2026
        '%Y/%m/%d',  # 2026/02/15
        '%b %d, %Y', # Feb 15, 2026
        '%B %d, %Y', # February 15, 2026
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    return None


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
            queryset = queryset.filter(tags__contains=[tag])

        queryset = queryset.order_by('-created_at')[:500]
        
        serializer = CustomerSerializer(queryset, many=True)
        return Response({
            'customers': [to_camel_case(customer) for customer in serializer.data],
            'total': len(serializer.data)
        }, status=status.HTTP_200_OK)

    def post(self, request):
        user = request.user
        if not user.business_id:
            return Response({'error': 'No business associated with user'}, status=status.HTTP_400_BAD_REQUEST)

        # Parse request body (expected camelCase) Safely with null-coercion and type guards
        full_name = str(request.data.get('fullName') or '').strip()
        raw_phone = str(request.data.get('phone') or '').strip()
        email = str(request.data.get('email') or '').strip()
        city = str(request.data.get('city') or '').strip()
        language = str(request.data.get('language') or 'en').strip()
        customer_type = str(request.data.get('customerType') or '').strip()
        tags = request.data.get('tags') or []
        due_date = request.data.get('dueDate')
        appointment_date = request.data.get('appointmentDate')
        notes = str(request.data.get('notes') or '').strip()
        consent_status = str(request.data.get('consentStatus') or 'granted').strip()
        custom_fields = request.data.get('customFields')

        if not full_name or not raw_phone:
            return Response({'error': 'Missing name or phone'}, status=status.HTTP_400_BAD_REQUEST)

        phone = format_phone(raw_phone)
        if not is_valid_indian_phone(phone):
            return Response({'error': 'Invalid Indian phone number'}, status=status.HTTP_400_BAD_REQUEST)

        if isinstance(tags, str):
            tags_list = [tag.strip() for tag in tags.split(',') if tag.strip()]
        elif isinstance(tags, list):
            tags_list = [str(tag).strip() for tag in tags if str(tag).strip()]
        else:
            tags_list = []

        try:
            customer = Customer.objects.create(
                business_id=user.business_id,
                full_name=full_name,
                phone=phone,
                email=email if email else None,
                city=city if city else None,
                language=language if language in ['en', 'hi', 'gu'] else 'en',
                customer_type=customer_type if customer_type else None,
                tags=tags_list,
                due_date=parse_date_string(due_date),
                appointment_date=parse_date_string(appointment_date),
                notes=notes if notes else None,
                consent_status=consent_status,
                custom_fields=custom_fields if isinstance(custom_fields, dict) else {}
            )

            serializer = CustomerSerializer(customer)
            return Response({'customer': to_camel_case(serializer.data)}, status=status.HTTP_201_CREATED)
        except Exception as exception:
            return Response({'error': str(exception)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
                elif camel_k in ['dueDate', 'appointmentDate']:
                    val = parse_date_string(val)
                setattr(customer, snake_k, val if val != '' else None)

        if 'tags' in request.data:
            tags = request.data.get('tags')
            if isinstance(tags, str):
                customer.tags = [tag.strip() for tag in tags.split(',') if tag.strip()]
            elif isinstance(tags, list):
                customer.tags = [str(tag).strip() for tag in tags if str(tag).strip()]
            else:
                customer.tags = []

        if 'customFields' in request.data:
            cfields = request.data.get('customFields')
            customer.custom_fields = cfields if isinstance(cfields, dict) else {}

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
        # Return sample CSV for download
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

        standard_keys = {
            'fullName', 'phone', 'email', 'city', 'language', 
            'customerType', 'notes', 'dueDate', 'appointmentDate'
        }

        for row in rows:
            full_name = str(row.get('fullName') or '').strip()
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

            email = str(row.get('email') or '').strip()
            city = str(row.get('city') or '').strip()
            language = str(row.get('language') or 'en').strip()
            customer_type = str(row.get('customerType') or '').strip()
            notes = str(row.get('notes') or '').strip()
            due_date = row.get('dueDate')
            appointment_date = row.get('appointmentDate')

            # Parse language cleanly (e.g. "English" or "Hindi" or "Gujarati" -> en, hi, gu)
            lang_clean = 'en'
            lang_raw = language.lower()
            if lang_raw.startswith('en'):
                lang_clean = 'en'
            elif lang_raw.startswith('hi') or lang_raw.startswith('hin'):
                lang_clean = 'hi'
            elif lang_raw.startswith('gu'):
                lang_clean = 'gu'

            # Gather extra keys into custom fields
            extra_fields = {}
            for k, v in row.items():
                if k not in standard_keys and v is not None:
                    v_str = str(v).strip()
                    if v_str and v_str != 'nan' and v_str != 'None':
                        extra_fields[k] = v_str
            
            # Handle tag formatting matching Next.js logic
            tags_list = [customer_type] if customer_type else []

            customers_to_create.append(
                Customer(
                    business_id=user.business_id,
                    full_name=full_name,
                    phone=phone,
                    email=email if email and email not in ['nan', 'None'] else None,
                    city=city if city and city not in ['nan', 'None'] else None,
                    language=lang_clean,
                    customer_type=customer_type if customer_type and customer_type not in ['nan', 'None'] else None,
                    tags=tags_list,
                    notes=notes if notes and notes not in ['nan', 'None'] else None,
                    due_date=parse_date_string(due_date),
                    appointment_date=parse_date_string(appointment_date),
                    consent_status='granted',
                    custom_fields=extra_fields
                )
            )
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
        return [to_camel_case(item) for item in data]
    elif isinstance(data, dict):
        new_dict = {}
        for key, value in data.items():
            parts = key.split('_')
            camel_key = parts[0] + ''.join(x.title() for x in parts[1:])
            if camel_key in ['customFields', 'options']:
                # Retain raw user-defined custom metadata formats
                new_dict[camel_key] = value
            else:
                new_dict[camel_key] = to_camel_case(value)
        return new_dict
    else:
        return data


# Safe, dynamic query generation compiler translating filter rules to Django Q objects
def compile_filters_to_q(filter_groups, business_id):
    final_query = Q(business_id=business_id)
    
    if not filter_groups:
        return final_query
        
    for group_data in filter_groups:
        group_query = None
        logic_operator = group_data.get('logic_operator', 'AND').upper() or group_data.get('logicOperator', 'AND').upper()
        rules = group_data.get('rules', [])
        
        for rule in rules:
            field_name = rule.get('field_name', '').strip() or rule.get('fieldName', '').strip()
            operator = rule.get('operator', '').strip().upper()
            value = rule.get('value')
            if operator == 'IN' and isinstance(value, str):
                value = [value]
            
            rule_q = Q()
            
            # --- core fields filters ---
            if field_name == 'city':
                if operator == 'EQUALS': rule_q = Q(city__iexact=value)
                elif operator == 'NOT_EQUALS': rule_q = ~Q(city__iexact=value)
                elif operator == 'IN': rule_q = Q(city__in=value)
                elif operator == 'CONTAINS': rule_q = Q(city__icontains=value)
                elif operator == 'STARTS_WITH': rule_q = Q(city__istartswith=value)
                elif operator == 'ENDS_WITH': rule_q = Q(city__iendswith=value)
                elif operator == 'IS_NULL': rule_q = Q(city__isnull=True)
                elif operator == 'IS_NOT_NULL': rule_q = Q(city__isnull=False)
                
            elif field_name == 'customer_type' or field_name == 'customerType':
                if operator == 'EQUALS': rule_q = Q(customer_type__iexact=value)
                elif operator == 'NOT_EQUALS': rule_q = ~Q(customer_type__iexact=value)
                elif operator == 'IN': rule_q = Q(customer_type__in=value)
                elif operator == 'CONTAINS': rule_q = Q(customer_type__icontains=value)
                elif operator == 'IS_NULL': rule_q = Q(customer_type__isnull=True)
                elif operator == 'IS_NOT_NULL': rule_q = Q(customer_type__isnull=False)
                
            elif field_name == 'due_date' or field_name == 'dueDate':
                if operator == 'EQUALS': rule_q = Q(due_date=value)
                elif operator == 'GREATER_THAN': rule_q = Q(due_date__gt=value)
                elif operator == 'LESS_THAN': rule_q = Q(due_date__lt=value)
                elif operator == 'GREATER_THAN_EQUAL': rule_q = Q(due_date__gte=value)
                elif operator == 'LESS_THAN_EQUAL': rule_q = Q(due_date__lte=value)
                elif operator == 'BETWEEN' and isinstance(value, list) and len(value) == 2:
                    rule_q = Q(due_date__range=(value[0], value[1]))
                elif operator == 'IS_NULL': rule_q = Q(due_date__isnull=True)
                elif operator == 'IS_NOT_NULL': rule_q = Q(due_date__isnull=False)
                
            elif field_name == 'appointment_date' or field_name == 'appointmentDate':
                if operator == 'EQUALS': rule_q = Q(appointment_date=value)
                elif operator == 'GREATER_THAN': rule_q = Q(appointment_date__gt=value)
                elif operator == 'LESS_THAN': rule_q = Q(appointment_date__lt=value)
                elif operator == 'GREATER_THAN_EQUAL': rule_q = Q(appointment_date__gte=value)
                elif operator == 'LESS_THAN_EQUAL': rule_q = Q(appointment_date__lte=value)
                elif operator == 'BETWEEN' and isinstance(value, list) and len(value) == 2:
                    rule_q = Q(appointment_date__range=(value[0], value[1]))
                elif operator == 'IS_NULL': rule_q = Q(appointment_date__isnull=True)
                elif operator == 'IS_NOT_NULL': rule_q = Q(appointment_date__isnull=False)

            elif field_name == 'tags':
                if operator == 'EQUALS' or operator == 'CONTAINS':
                    rule_q = Q(tags__contains=[value])
                elif operator == 'NOT_EQUALS' or operator == 'NOT_CONTAINS':
                    rule_q = ~Q(tags__contains=[value])
                elif operator == 'IN' or operator == 'CONTAINS_ANY':
                    if isinstance(value, list):
                        rule_q = Q(tags__overlap=value)
                    else:
                        rule_q = Q(tags__contains=[value])
                elif operator == 'CONTAINS_ALL':
                    if isinstance(value, list):
                        rule_q = Q(tags__contains=value)
                    else:
                        rule_q = Q(tags__contains=[value])
                elif operator == 'IS_NULL':
                    rule_q = Q(tags=[])
                elif operator == 'IS_NOT_NULL':
                    rule_q = ~Q(tags=[])

            elif field_name == 'full_name' or field_name == 'fullName':
                if operator == 'EQUALS': rule_q = Q(full_name__iexact=value)
                elif operator == 'NOT_EQUALS': rule_q = ~Q(full_name__iexact=value)
                elif operator == 'CONTAINS': rule_q = Q(full_name__icontains=value)
                elif operator == 'STARTS_WITH': rule_q = Q(full_name__istartswith=value)

            elif field_name == 'phone':
                if operator == 'EQUALS': rule_q = Q(phone=value)
                elif operator == 'CONTAINS': rule_q = Q(phone__contains=value)

            elif field_name == 'email':
                if operator == 'EQUALS': rule_q = Q(email__iexact=value)
                elif operator == 'NOT_EQUALS': rule_q = ~Q(email__iexact=value)
                elif operator == 'CONTAINS': rule_q = Q(email__icontains=value)
                elif operator == 'IS_NULL': rule_q = Q(email__isnull=True)
                elif operator == 'IS_NOT_NULL': rule_q = Q(email__isnull=False)

            elif field_name == 'language':
                if operator == 'EQUALS': rule_q = Q(language=value)
                elif operator == 'IN': rule_q = Q(language__in=value)

            elif field_name == 'consent_status' or field_name == 'consentStatus':
                if operator == 'EQUALS': rule_q = Q(consent_status=value)

            # --- dynamic custom jsonb fields filters ---
            elif field_name.startswith('custom_fields.') or field_name.startswith('customFields.'):
                parts = field_name.split('.')
                if len(parts) >= 2 and parts[1].strip():
                    json_key = parts[1].strip()
                    lookup_path = f"custom_fields__{json_key}"
                    
                    if operator == 'EQUALS': rule_q = Q(**{lookup_path: value})
                    elif operator == 'NOT_EQUALS': rule_q = ~Q(**{lookup_path: value}) | Q(**{f"{lookup_path}__isnull": True})
                    elif operator == 'CONTAINS': rule_q = Q(**{f"{lookup_path}__icontains": value})
                    elif operator == 'GREATER_THAN': rule_q = Q(**{f"{lookup_path}__gt": value})
                    elif operator == 'LESS_THAN': rule_q = Q(**{f"{lookup_path}__lt": value})
                    elif operator == 'GREATER_THAN_EQUAL': rule_q = Q(**{f"{lookup_path}__gte": value})
                    elif operator == 'LESS_THAN_EQUAL': rule_q = Q(**{f"{lookup_path}__lte": value})
                    elif operator == 'IS_NULL': rule_q = Q(**{f"{lookup_path}__isnull": True})
                    elif operator == 'IS_NOT_NULL': rule_q = Q(**{f"{lookup_path}__isnull": False})
                else:
                    continue

            # Append rule to group query
            if group_query is None:
                group_query = rule_q
            else:
                if logic_operator == 'OR':
                    group_query |= rule_q
                else:
                    group_query &= rule_q
                    
        if group_query is not None:
            final_query &= group_query
        
    return final_query


class AudiencePreviewView(APIView):
    """
    Exposes dry-run query count previews for interactive CRM UI Rule-Builders.
    Returns dynamic count matching criteria alongside a quick 10-contact sample.
    """
    def post(self, request):
        user = request.user
        if not user.business_id:
            return Response({'count': 0, 'customers': []}, status=status.HTTP_200_OK)

        filter_groups = request.data.get('filter_groups') or request.data.get('filterGroups', [])
        
        # Compile criteria to parameterized django query constraints
        q_constraints = compile_filters_to_q(filter_groups, user.business_id)
        
        try:
            # Perform query
            queryset = Customer.objects.filter(q_constraints).order_by('full_name')
            total_count = queryset.count()
            
            # Retain a quick preview of up to 10 matching clients for instant frontend visualization
            preview_set = queryset[:10]
            serializer = CustomerSerializer(preview_set, many=True)
            
            return Response({
                'count': total_count,
                'customers': [to_camel_case(customer) for customer in serializer.data]
            }, status=status.HTTP_200_OK)
        except Exception as exception:
            return Response({
                'error': f'Invalid filter constraints: {str(exception)}'
            }, status=status.HTTP_400_BAD_REQUEST)
