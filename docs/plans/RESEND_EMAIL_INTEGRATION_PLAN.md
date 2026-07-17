# Receptify — Resend Email Integration and SMTP Removal Plan

## 1. Problem Statement

### Current State
Receptify currently uses standard SMTP configuration settings (EMAIL_HOST, EMAIL_PORT, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD, EMAIL_USE_TLS) for email dispatch. These settings are prone to configuration errors, delivery blocks, and credential leaks. Email sending functions utilize Django's built-in "send_mail" wrapper.

### Desired State
We want to transition email dispatch entirely to the official Resend SDK. 
1. Remove all legacy SMTP configuration parameters from settings and templates.
2. Implement a custom Django email backend "ResendEmailBackend" that translates standard Django "send_mail" calls into official Resend SDK requests.
3. Consolidate environment variables so that only the "RESEND_API_KEY" is required.

---

## 2. Current Architecture

Emails are dispatched asynchronously or synchronously via views on the Django backend.
- **Email Sending Helpers:** `backend/receptify/views_auth.py`
  - Utilizes "send_verification_email(user)" and "send_reset_email(user)" to trigger account verify and password reset emails.
  - Both helpers import "send_mail" from "django.core.mail" to deliver messages.
- **Django Configuration:** `backend/receptify/settings.py`
  - Defines settings like "EMAIL_BACKEND", "EMAIL_HOST", "EMAIL_PORT", "EMAIL_USE_TLS", etc.

---

## 3. What Changes vs. What Stays

### What Stays Unchanged
- The "send_verification_email" and "send_reset_email" function interfaces inside "receptify/views_auth.py" remain fully identical.
- The templates, parameters, and login endpoints remain unchanged.
- Next.js email verification and reset password route layouts remain unchanged.

### What Changes
- **Dependencies:** "resend" package is added to "backend/requirements.txt".
- **Backend Email Backend:** A new file "backend/receptify/email_backend.py" is created, implementing "ResendEmailBackend" subclassing Django's "BaseEmailBackend".
- **Settings:** "EMAIL_BACKEND" is changed to target our new custom backend class. All SMTP parameters are removed. "RESEND_API_KEY" is added.
- **Environment Templates:** "backend/.env.example" is updated to replace SMTP variables with "RESEND_API_KEY".

---

## 4. Implementation Steps

### Step 1: Package Dependency Installation
- **Files Modified:** `backend/requirements.txt`
- **Action:** Add the "resend" package to backend requirements.
- **Verification:** Run "pip install -r backend/requirements.txt" to verify installation.

### Step 2: Custom Resend Email Backend
- **Files Created:** `backend/receptify/email_backend.py` (Note: No code blocks in plan files)
- **Action:** Create a custom email backend class that extends Django's BaseEmailBackend. This backend takes django EmailMessage objects and forwards them to the Resend API using the official SDK.
- **Verification:** Run a simple python snippet to instantiate the backend and trigger a mock mail.

### Step 3: Settings Adjustment and SMTP Removal
- **Files Modified:** `backend/receptify/settings.py`
- **Action:** Change EMAIL_BACKEND to point to receptify.email_backend.ResendEmailBackend. Remove all configuration variables related to SMTP. Add configuration loader for RESEND_API_KEY.
- **Verification:** Start Django development server and ensure settings load cleanly with no syntax or lookup errors.

---

## 5. Risks and Open Questions

- **Resend API Key Absence Fallback:** If "RESEND_API_KEY" is empty, ensure the backend falls back gracefully to Django's standard ConsoleBackend ("django.core.mail.backends.console.EmailBackend") in local development so offline work remains functional.

---

## 6. Acceptance Criteria

- [ ] "backend/requirements.txt" contains the official "resend" package.
- [ ] A custom "ResendEmailBackend" is implemented inside "backend/receptify/email_backend.py".
- [ ] Legacy SMTP configuration settings are removed from "backend/receptify/settings.py".
- [ ] Calling "send_verification_email" or "send_reset_email" successfully uses the custom backend and dispatches emails via the Resend SDK.
- [ ] If "RESEND_API_KEY" is empty in debug mode, it falls back to printing email contents to the standard terminal output console.
- [ ] All 29 Django unit tests pass successfully with 0 errors.
