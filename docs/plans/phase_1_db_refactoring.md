# Implementation Plan: Phase 1 Database & Model Refactoring

## Problem Statement
The current database architecture for customer data is rigid and unoptimized for enterprise-level CRM capabilities. Custom attributes for business clients lack validation and structure, tags are stored as unstructured text, and there are no indexing optimizations for querying custom JSONB attributes, which will cause performance bottlenecks when scaling to millions of customer records.

The desired state is to introduce a metadata model for custom field definitions, transition tags to a Postgres-native array, and add GIN indexes to enable performant, dynamic, validated customer querying.

## Current Architecture
The current customer data architecture consists of:
- Customer model: Customer (backend/customers/models.py) with phone, email, city, language, tags (stored as TextField), and custom_fields (JSONField).
- Existing test suite: CustomerViewsTestCase (backend/customers/tests.py) which tests manual creation and CSV uploads, including JSON processing.
- Settings: DATABASES (backend/receptify/settings.py) which configures PostgreSQL as the primary database backend.

## What Changes vs What Stays

### What Changes:
- backend/customers/models.py:
  - Add CustomFieldDefinition model representing dynamic field schemas per business.
  - Refactor Customer.tags field from TextField to ArrayField of CharField.
  - Add GIN indexing on Customer.custom_fields (using jsonb_path_ops) and Customer.tags.
- backend/customers/tests.py:
  - Update the custom_fields aggregation test to parse a dictionary directly rather than running json.loads on JSONField output.
  - Add test coverage for CustomFieldDefinition creation.
- django migrations:
  - Create database migration files mapping schema changes and a custom data migration converting legacy comma-separated tags to list formats.

### What Stays:
- Core fields such as phone, email, city, full_name, and language on Customer model remain unmodified.
- The existing CampaignFilterGroup and CampaignFilterRule models in backend/campaigns/models.py remain unmodified.
- API views like CustomerListCreateView and CustomerDetailView remain unmodified for this database-only refactoring phase.

## Implementation Steps

1. Create CustomFieldDefinition Model
   - Define CustomFieldDefinition with fields: id, business, name, key, field_type (choices: TEXT, NUMBER, BOOLEAN, DATE, DROPDOWN, MULTI_SELECT, CURRENCY), is_required, options (using default=list JSONField), and group_name.
   - Files: backend/customers/models.py
   - Verification: Run makemigrations to generate the schema migration file.

2. Refactor Customer.tags and Add GIN Indexing
   - Import ArrayField from django.contrib.postgres.fields.
   - Change Customer.tags to ArrayField(models.CharField(max_length=100), default=list, blank=True).
   - Add GinIndex for custom_fields (using jsonb_path_ops) and tags in the Customer Meta class.
   - Files: backend/customers/models.py
   - Verification: Run makemigrations to generate the schema migration file.

3. Legacy Tags Data Migration
   - Create a blank migration after the schema changes.
   - Implement forward and backward data migration logic to split comma-separated strings into lists, cleaning up whitespace and empty strings.
   - Files: backend/customers/migrations/
   - Verification: Run django migrations and inspect local PostgreSQL database.

4. Test Suite Refactoring
   - Update CustomerViewsTestCase in backend/customers/tests.py to handle dictionary output from JSONField and verify model structure.
   - Files: backend/customers/tests.py
   - Verification: Run python backend/manage.py test customers --noinput and verify all tests pass.

## Risks and Open Questions
- SQLite compatibility: Since local development and CI use Postgres, Postgres-specific ArrayField and GIN Indexing are fully safe.
- Data integrity during migration: Existing tags containing commas might have leading/trailing spaces. The data migration must trim strings and discard empty items to prevent dirty arrays.

## Acceptance Criteria
- CustomFieldDefinition model exists with validation choices.
- Customer.tags is an ArrayField in PostgreSQL.
- GIN Indexes are successfully applied to custom_fields (jsonb_path_ops) and tags.
- All legacy tags are cleanly converted to Postgres arrays.
- The django test suite runs and passes with zero errors.
