# Customer Data, Campaign Filtering & Database Architecture Research

## 1. Industry Research: Customer Data Management

Different businesses manage varying types of customer data. Here's a breakdown by industry:

| Industry | Core Required Fields | Custom / Industry-Specific Fields | Customer Lifecycle Stages | Common Segments & Filters |
| :--- | :--- | :--- | :--- | :--- |
| **Real Estate** | Name, Phone, Email | Property Type, Budget, Preferred Location, Financing Status | Lead → Viewing Scheduled → Negotiation → Closed (Won/Loss) | Budget range, property interest, days since last contact |
| **Healthcare** | Name, Phone, DOB | Patient ID, Last Visit, Next Appointment, Insurance Provider | New Patient → Active → Lapsed | Days since last checkup, specific insurance type, age group |
| **Insurance** | Name, Phone, Email | Policy Type, Renewal Date, Premium Amount, Claims History | Prospect → Quoted → Active Policyholder → Renewal | Policy expiring in < 30 days, high-value premium, cross-sell |
| **E-commerce** | Name, Email, Phone | Total Spend, Last Purchase Date, Cart Abandonment | Visitor → One-time Buyer → Repeat Customer → VIP | Abandoned cart within 24h, high lifetime value (LTV) |
| **Education** | Name, Phone, Email | Course/Major, Enrollment Date, Graduation Year | Prospect → Applicant → Enrolled → Alumni | Interested in specific course, application incomplete |
| **Finance** | Name, Phone, Email | Account Type, Income Range, Credit Score Range | Lead → Qualified → Onboarded → Active | High net worth, missing KYC, loan status |

### General Data Requirements:
- **Privacy & Compliance**: GDPR, CCPA, HIPAA (if healthcare). Consent logs (opt-in/opt-out) are mandatory.
- **Validation**: Strict phone formatting (E.164), email validation, date parsing.

---

## 2. Platform Analysis (Current State)

Reviewing the current `Customer` and `Campaign` models in `backend/customers/models.py` and `backend/campaigns/models.py`:

**Current Customer Model:**
- **Core fields**: `id`, `full_name`, `phone`, `email`, `city`, `language`, `business_id`
- **Business-specific fields**: `customer_type`, `due_date`, `appointment_date`, `notes`, `tags`
- **Flexibility**: Uses `custom_fields = models.JSONField()`
- **Compliance**: `consent_status`

**Current Campaign Filter Models:**
- `CampaignFilterGroup` (AND/OR logic)
- `CampaignFilterRule` (`field_name`, `operator`, `value` in JSON)

### Limitations & Areas for Improvement:
1. **Missing Normalization**: `tags` is a `TextField` (string). It should ideally be an ArrayField (if Postgres) or normalized in a `CustomerTag` table for faster indexing and filtering.
2. **Schema Rigidity**: Fields like `due_date` and `appointment_date` are hardcoded in the model. These are highly specific to certain industries (e.g., healthcare/services) and should ideally be managed dynamically via a Business Field definition system, storing the data in `custom_fields`.
3. **Validation Issues**: `custom_fields` currently lacks a strict schema validation mechanism. If a client expects a `Date`, there's no backend rule preventing a `String` from being saved, breaking dynamic filtering.
4. **Scalability Concerns**: Filtering on unstructured JSONB fields without GIN indexes will result in full-table scans when scaling to millions of rows.

---

## 3. Dynamic Customer Fields: System Design

To support true flexibility without altering the database schema for every new field, we need a **Schema Definition Model**.

### Database Schema Recommendations:

1. **`CustomFieldDefinition` (Table)**
   - `id` (UUID)
   - `business_id` (FK to Business)
   - `name` (String, e.g., "Policy Renewal Date")
   - `key` (String, e.g., "policy_renewal_date" - used in JSONB)
   - `field_type` (Enum: TEXT, NUMBER, BOOLEAN, DATE, DROPDOWN, MULTI_SELECT, CURRENCY)
   - `is_required` (Boolean)
   - `options` (JSONB, for storing dropdown/multi-select choices)
   - `group/category` (String, e.g., "Financial Info")

2. **`Customer` (Table - Updates)**
   - Maintain `custom_fields` as `JSONB`.
   - Remove hardcoded `due_date` and `appointment_date` (migrate these to custom fields).
   - Use Postgres GIN Indexing on `custom_fields` for fast JSON querying.

### Behavior:
When a business adds a new field via the UI, a `CustomFieldDefinition` is created. When a customer is saved, the backend validates the payload against the business's definitions before saving to the `custom_fields` JSONB column.

---

## 4. Campaign Audience Builder Design

Clients should build audiences using rules rather than manual selection. The UI will dynamically generate a payload that maps to the existing `CampaignFilterGroup` and `CampaignFilterRule` models.

### Audience Rule Capabilities:
- **Core Field Rules**: `Age`, `Status`, `City`, `Created Date`.
- **Dynamic Field Rules**: Automatically pull keys from `CustomFieldDefinition` to populate the filter dropdowns.
- **Operators mapping**:
  - String: `EQUALS`, `NOT_EQUALS`, `CONTAINS`, `STARTS_WITH`
  - Number/Date: `EQUALS`, `GREATER_THAN`, `LESS_THAN`, `BETWEEN`
  - Array/Tags: `IN`, `NOT_IN`, `CONTAINS_ALL`, `CONTAINS_ANY`
  - General: `IS_SET`, `IS_NOT_SET` (Null checks)

---

## 5. Dynamic Filter Database Design

The current structure is good:
- **`CampaignFilterGroup`**: `campaign_id`, `logic_operator` (AND/OR).
- **`CampaignFilterRule`**: `group_id`, `field_name`, `operator`, `value` (JSON).

### Enhancement:
Add a `rule_type` enum to `CampaignFilterRule` to distinguish between `CORE_FIELD` and `CUSTOM_FIELD`. This simplifies query generation, as core fields are queried natively, while custom fields require JSONB querying syntax.

---

## 6. Query Generation & PostgreSQL Optimization

Converting `CampaignFilterGroup` and `CampaignFilterRule` to SQL queries dynamically using Django ORM.

### Dynamic Query Approach (Django `Q` objects):
```python
from django.db.models import Q

def generate_query(filter_group):
    q_objects = Q()
    for rule in filter_group.rules.all():
        rule_q = build_rule_q(rule)
        if filter_group.logic_operator == 'AND':
            q_objects &= rule_q
        else:
            q_objects |= rule_q
    return q_objects

def build_rule_q(rule):
    if rule.is_custom_field:
        # JSONB Querying using Django's keys-based lookups
        lookup = f"custom_fields__{rule.field_name}__{rule.operator.lower()}"
        return Q(**{lookup: rule.value})
    else:
        # Core Field Querying
        lookup = f"{rule.field_name}__{rule.operator.lower()}"
        return Q(**{lookup: rule.value})
```

### Database Optimization Strategies:
1. **GIN Indexes**: Add `GinIndex(fields=['custom_fields'])` to the `Customer` model.
2. **Partial Indexes**: If certain core fields are filtered heavily (e.g., `status = 'active'`), create partial B-tree indexes.
3. **Pagination**: Use keyset pagination (cursor-based) instead of `OFFSET`/`LIMIT` for audience preview queries on large datasets.
4. **Caching**: Store total audience counts in Redis and invalidate when a customer profile matching the campaign criteria is updated.

---

## 7. UI Research: Enterprise CRM Filter Builders

### UI/UX Best Practices (Inspired by HubSpot, Salesforce, Customer.io):
1. **Visual Hierarchy**: Group logic visually using nested blocks. Outer blocks are typically "AND", and inner conditions can be "OR".
2. **Progressive Disclosure**: When selecting a field (e.g., "Date"), dynamically update the operator dropdown to show only date-compatible operators (`Before`, `After`, `Between`).
3. **Real-time Preview**: Show an "Estimated Audience Size" counter that updates dynamically (debounced) as the user changes rules.
4. **Saved Segments**: Allow users to save a `CampaignFilterGroup` as a "Saved Audience" for reuse across multiple campaigns.

---

## 8. Implementation Plan & System Architecture

### Phase 1: Database & Model Refactoring
1. Create `CustomFieldDefinition` model.
2. Refactor `Customer.tags` to `ArrayField(CharField)`.
3. Add GIN Index to `Customer.custom_fields`.
4. Run Django migrations.

### Phase 2: API Development
1. **Settings API**: CRUD endpoints for `CustomFieldDefinition`.
2. **Customer API**: Update `POST/PUT /customers/` to dynamically validate payload against definitions.
3. **Audience Preview API**: `POST /campaigns/preview-audience` -> Takes a JSON payload of rules, builds the Django `Q` query, and returns `{ count: 1543 }`.

### Phase 3: Frontend Filter Builder UI
1. Build a recursive React component `<FilterGroup />` and `<FilterRule />`.
2. Fetch `CustomFieldDefinition`s on mount to populate the "Field" dropdown.
3. Implement debounce logic calling the Audience Preview API to update the live counter.

### Phase 4: Campaign Execution Engine
1. Update the Campaign Dialer to execute the dynamically generated `Q` query at the scheduled calling time rather than relying on a static `CampaignCustomer` mapping table (or populate the table right before execution).
