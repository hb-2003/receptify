---
name: backend-patterns
description: Core architectural patterns, styling, and standard practices for Receptify backend development.
---

# Receptify Backend Patterns

Use this skill when writing or modifying Python/Django code in the backend. For naming decisions, use the `naming-conventions` skill. For API-specific patterns (views, response serialization, permissions), use the `api-design` skill.

## Import Ordering

Follow this order, with a blank line between each group:

1. Standard library (`import re`, `import uuid`, `import random`, `import time`)
2. Django (`from django.db import models`, `from django.db.models import Q`)
3. Third-party (`from rest_framework import status`, `from decouple import config`)
4. Internal — other apps (`from receptify.models import Business`, `from customers.models import Customer`)
5. Internal — same app (`from .models import Campaign`, `from .serializers import CampaignSerializer`)

Use function-level imports only to break circular dependencies — place them at the top of the method body, not at the top of the file.

## Model Patterns

- **UUID Primary Keys:** All models use UUID fields as primary keys:
  ```python
  id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
  ```
- **Timestamps:** Models use `created_at` / `updated_at` timestamps:
  ```python
  created_at = models.DateTimeField(auto_now_add=True)
  updated_at = models.DateTimeField(auto_now=True)
  ```
- **Explicit Table Names:** Always set the `db_table` name inside the Meta class:
  ```python
  class Meta:
      db_table = 'campaigns'
  ```
- **Foreign Keys:** Use descriptive names for foreign keys and explicitly define `db_column` to map properly to the database:
  ```python
  business = models.ForeignKey(Business, on_delete=models.CASCADE, db_column='business_id')
  ```

## Helper and Validation Patterns

- Place utility and validation helpers inside the app views/helpers where they are used.
- **Phone validation and formatting:** For India-focused SME calling, phone numbers must be formatted and verified.
  - Format to standard `+91` format.
  - Verify that the first digit of the 10-digit number starts with 6-9.
  ```python
  def format_phone(phone: str) -> str:
      digits = re.sub(r'\D', '', phone)
      if len(digits) == 10:
          return f'+91{digits}'
      return phone
  ```

## Error Handling

- **In Views:** Raise or return `rest_framework.response.Response` with descriptive errors (e.g. `{'error': 'Invalid Indian phone number'}`) and appropriate status codes (`status.HTTP_400_BAD_REQUEST`).
- **Data Integrity:** Wrap critical multi-row operations inside `transaction.atomic` blocks to ensure DB consistency.

## Background Task & Calling Simulation Worker

Since calling campaigns execute in the background, we use an asynchronous task pattern:
- Spawn calling simulations in a separate thread:
  ```python
  def launch_campaign_view(request, id):
      # ... logic to fetch campaign ...
      threading.Thread(target=run_mock_campaign, args=(campaign.id,)).start()
      return Response({'status': 'launched'})
  ```
- The `run_mock_campaign` worker must handle state transitions (`queued -> ringing -> in_progress -> completed/failed/no_answer`), generate transcripts and summaries, and update campaign aggregates under a clean transaction.

## Testing Patterns

- Write tests to verify both standard CRUD operations and background calling behavior.
- Ensure authentication headers are mock-passed or cookies are populated with valid JWT keys.
