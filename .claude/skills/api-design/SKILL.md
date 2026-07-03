# Receptify API Design Patterns

Use this skill when creating new API endpoints, Django Views/APIViews, serializers, or modifying existing API behavior.

## When to Use

- Adding a new API endpoint, View, or APIView
- Creating or modifying serializers
- Adding new permissions or access controls
- Working with the bulk AI calling pipeline

## URL Structure

All endpoints are registered modularly in `backend/receptify/urls.py` under `/api/`.

Follow the modular app convention:
- Customer endpoints: `/api/customers/`
- Campaign endpoints: `/api/campaigns/`
- Call history endpoints: `/api/calls/`
- LLM generation endpoints: `/api/llm/`

Examples:
- List/Create Customers: `/api/customers/`
- CSV Customer Upload: `/api/customers/upload`
- Delete Customer: `/api/customers/<uuid:id>`
- Generate LLM Script: `/api/llm/generate-script`

## APIView and View Patterns

### Business Scoping (Mandatory)

Every View/APIView MUST filter resources by `self.request.user.business_id`. There is no global unscoped API endpoint.

The business context is set by the authentication middleware and Django rest framework authentication, which identifies the authenticated `User` and their associated `Business` ID (`user.business_id`).

Always query with business scoping:
```python
user = request.user
queryset = Customer.objects.filter(business_id=user.business_id)
```

### Response Key Formatting (camelCase)

The React/Next.js frontend expects response JSON payloads to have keys formatted in **camelCase**, while Django database fields and standard DRF serializer output are in **snake_case**.

To bridge this gap, views must format the returned dictionary using a camelCase utility:
```python
from customers.views import to_camel_case

serializer = CustomerSerializer(queryset, many=True)
return Response({
    'customers': [to_camel_case(c) for c in serializer.data],
    'total': len(serializer.data)
}, status=status.HTTP_200_OK)
```

### Permission Classes

Choose the right permission class based on the endpoint:
- Use `IsAuthenticated` (default) for standard secure SME dashboard actions.
- Use `AllowAny` only for public-facing/auth routes like login, signup, or public landing interactions.

## Serializer Patterns

### Organization

Serializers live in modular Django apps organized by domain:
- `customers/serializers.py` — Customer-specific
- `campaigns/serializers.py` — Campaign, Template, Script
- `calls/serializers.py` — Call, CallTranscript, CallRecording

### Custom Deserialization (camelCase Input Handling)

When parsing request body payloads, remember that the frontend sends camelCase keys. Parse these fields explicitly in the view or serializer:
```python
full_name = request.data.get('fullName', '').strip()
customer_type = request.data.get('customerType', '').strip()
```

## Mock Calling Pipeline

When working with Campaign execution or Calls, leverage the mock calling engine simulator:
- Campaigns can be launched via `/api/campaigns/<uuid:id>/launch`.
- The async simulator worker (`run_mock_campaign`) loops through campaign customers, transitioning call statuses `queued -> ringing -> in_progress -> completed/failed/no_answer`.
- It generates realistic transcripts, recording silent audio WAV placeholders, and updates campaign aggregates (`calls_completed`, `calls_answered`, etc.).

## API Response Patterns

### Success Responses
- Return structured JSON payloads with camelCase keys.
- Return appropriate HTTP status codes (e.g., `201 CREATED` for resource creation, `200 OK` for reads/updates).

### Error Responses
- Raise standard DRF or Django ValidationErrors.
- Returns `400 BAD_REQUEST` with clear field validation messages or general descriptive errors.
- Never expose raw Python tracebacks to the client.
