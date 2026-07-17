# Dynamic CRM Segment Filter Compiler Helpers

from django.db.models import Q
from django.core.exceptions import ValidationError

# Safe, dynamic query generation compiler translating filter rules to Django Q objects
def compile_filters_to_q(filter_groups, business_id):
    final_query = Q(business_id=business_id)
    
    if not filter_groups:
        return final_query
        
    groups_query = None
    
    for group_data in filter_groups:
        group_query = None
        raw_logic_op = group_data.get('logic_operator') or group_data.get('logicOperator') or 'AND'
        logic_operator = str(raw_logic_op).strip().upper()
        rules = group_data.get('rules', [])
        
        for rule in rules:
            field_name = rule.get('field_name', '').strip() or rule.get('fieldName', '').strip()
            operator = rule.get('operator', '').strip().upper()
            value = rule.get('value')
            if operator == 'IN' and isinstance(value, str):
                value = [value]
            
            rule_q = None
            
            # Helper to validate value presence
            is_null_op = operator in ['IS_NULL', 'IS_NOT_NULL']
            if not is_null_op and value is None:
                raise ValidationError(f"Value cannot be empty for operator '{operator}' on field '{field_name}'")
            
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
                
            elif field_name in ['customer_type', 'customerType']:
                if operator == 'EQUALS': rule_q = Q(customer_type__iexact=value)
                elif operator == 'NOT_EQUALS': rule_q = ~Q(customer_type__iexact=value)
                elif operator == 'IN': rule_q = Q(customer_type__in=value)
                elif operator == 'CONTAINS': rule_q = Q(customer_type__icontains=value)
                elif operator == 'IS_NULL': rule_q = Q(customer_type__isnull=True)
                elif operator == 'IS_NOT_NULL': rule_q = Q(customer_type__isnull=False)
                
            elif field_name in ['due_date', 'dueDate']:
                if operator == 'EQUALS': rule_q = Q(due_date=value)
                elif operator == 'GREATER_THAN': rule_q = Q(due_date__gt=value)
                elif operator == 'LESS_THAN': rule_q = Q(due_date__lt=value)
                elif operator == 'GREATER_THAN_EQUAL': rule_q = Q(due_date__gte=value)
                elif operator == 'LESS_THAN_EQUAL': rule_q = Q(due_date__lte=value)
                elif operator == 'BETWEEN' and isinstance(value, list) and len(value) == 2:
                    rule_q = Q(due_date__range=(value[0], value[1]))
                elif operator == 'IS_NULL': rule_q = Q(due_date__isnull=True)
                elif operator == 'IS_NOT_NULL': rule_q = Q(due_date__isnull=False)
                
            elif field_name in ['appointment_date', 'appointmentDate']:
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

            elif field_name in ['full_name', 'fullName']:
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

            elif field_name in ['consent_status', 'consentStatus']:
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
                    raise ValidationError("Custom-field filter is missing a valid key path.")

            # If rule_q remains None, it means the field or operator is unsupported/unknown
            if rule_q is None:
                raise ValidationError(f"Unsupported or malformed rule: field '{field_name}' with operator '{operator}'")

            # Append rule to group query
            if group_query is None:
                group_query = rule_q
            else:
                if logic_operator == 'OR':
                    group_query |= rule_q
                else:
                    group_query &= rule_q
                    
        if group_query is not None:
            if groups_query is None:
                groups_query = group_query
            else:
                groups_query |= group_query
                
    if groups_query is not None:
        final_query &= groups_query
        
    return final_query
