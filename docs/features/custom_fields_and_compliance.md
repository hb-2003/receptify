# Dynamic Customer Fields & TRAI Compliance Guide

## Overview
Receptify allows businesses to dynamically define and manage custom customer attributes, build precise campaign segments using rule-based filters, and automatically scan and enforce compliance guidelines set by the **Telecom Regulatory Authority of India (TRAI)**. This guide explains how to configure custom customer attributes, build dynamic audiences, and write calling scripts that pass the TRAI Compliance Gate.

---

## 1. Dynamic Custom Fields

Standard CRMs limit customer profiles to static fields like Name, Email, and Phone. Receptify supports true flexibility through a dynamic **Schema Definition Model**. 

### How It Works
- **Schema Definition**: Business admins can create `CustomFieldDefinition` records. These define the custom properties expected for customer profiles.
- **JSONB Aggregation**: Customer-specific custom data is saved natively inside a single PostgreSQL `JSONB` column (`custom_fields`).
- **GIN Indexing**: All dynamic properties are indexed using Postgres `jsonb_path_ops` GIN indexing, making queries extremely fast even on millions of records.

### Supported Field Types:
- `TEXT`: Single-line text values.
- `NUMBER`: Numeric/integer properties.
- `BOOLEAN`: Yes/No toggles.
- `DATE`: Standard ISO dates (`YYYY-MM-DD`).
- `DROPDOWN`: Single select from pre-defined choices.
- `MULTI_SELECT`: Array/list of items.
- `CURRENCY`: Financial properties.

---

## 2. Dynamic Campaign Audience Builder

Instead of manually checking individual customers, campaigns are dispatched to dynamic audience segments compiled via logical filter cards.

### Filter Operator Capabilities:
- **EQUALS / NOT_EQUALS**: String matching on values.
  - *Edge Case Resolution*: `NOT_EQUALS` searches correctly include customer profiles that are missing the key entirely within their custom fields metadata.
- **IN**: Matches any item in a provided array.
  - *Safety Guard*: Single string arguments passed to `IN` filters are automatically wrapped inside arrays to prevent string character splitting errors.
- **GREATER_THAN / LESS_THAN**: Numeric and date comparisons.
- **IS_NULL / IS_NOT_NULL**: Checks if a dynamic custom property is defined or empty.

---

## 3. TRAI Compliance Gate

Indian telecommunication regulations strictly enforce and require active opt-out disclaimers and consent verification for automated outbound calling to protect citizen privacy.

### The Auto-Scan Rule Gate
Before any campaign can be launched, our systems perform an automatic script audit. Your script **MUST** satisfy these two rules:
1. **Length Gate**: The total script length must be at least **30 characters**.
2. **Opt-Out Indicators**: The script text must explicitly include at least one of these mandatory privacy keyphrases:
   - `opt-out`
   - `press 9`
   - `dnd`

If your script fails either check, the interface displays:
`Script Auto-Scan: NON-COMPLIANT ❌`
The "Next" button is disabled, blocking campaign schedule dispatches until the script is resolved.

### Compliant Script Example
> "Hello {{customer_name}}, this is [Business Name] calling regarding your invoice. **To opt-out of future calls, please press 9.** Thank you!"

---

## Troubleshooting & FAQs

### Problem: Checking all checkboxes in Step 5 does not clear the "NON-COMPLIANT" error.
- **Reason**: The TRAI Compliance Gate checks **both** your checked statements and the script text itself. If your script text in Step 3 does not contain opt-out wording (`opt-out`, `press 9`, or `dnd`), the gate will remain locked even if all checkboxes are verified.
- **Solution**: Go back to **Step 3 (Message)**, edit your script to include the DND disclaimer, or click the **"Auto-Generate Script"** button (which automatically appends a compliant opt-out disclaimer). Then return to the Compliance step.

### Problem: Dynamic field searches with a negation operator are missing some records.
- **Reason**: If a customer does not have the custom key defined in their JSON metadata, standard SQL comparisons evaluate as `UNKNOWN` and drop the row.
- **Solution**: Receptify's compiler is fully upgraded to append an `IS NULL` OR check automatically on all negation queries, ensuring missing keys are correctly evaluated as not matching the restricted target.
