import logging
from django.core.mail.backends.base import BaseEmailBackend
from django.core.mail.backends.console import EmailBackend as ConsoleEmailBackend
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
import resend

logger = logging.getLogger(__name__)


class ResendEmailBackend(BaseEmailBackend):
    """
    Custom Django Email Backend leveraging the official Resend Python SDK.
    Gracefully falls back to Django's built-in console email backend
    if RESEND_API_KEY is missing or empty ONLY in DEBUG mode.
    Raises ImproperlyConfigured in production mode to fail safe.
    """

    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        self.api_key = getattr(settings, "RESEND_API_KEY", "")
        self.is_debug_mode = getattr(settings, "DEBUG", False)
        self.should_use_console_fallback = not bool(self.api_key) and self.is_debug_mode

        if not self.api_key and not self.is_debug_mode:
            raise ImproperlyConfigured(
                "RESEND_API_KEY is missing or empty. Please set the RESEND_API_KEY "
                "environment variable in your production environment."
            )

        if self.should_use_console_fallback:
            logger.warning("RESEND_API_KEY is empty. Falling back to Django Console Email Backend.")
            self.fallback_backend = ConsoleEmailBackend(fail_silently=fail_silently, **kwargs)
        else:
            resend.api_key = self.api_key
            self.fallback_backend = None

    def send_messages(self, email_messages):
        if not email_messages:
            return 0

        # Redirect to console fallback if API key is not configured in local debug
        if self.should_use_console_fallback:
            return self.fallback_backend.send_messages(email_messages)

        sent_count = 0
        for message in email_messages:
            try:
                # Check for HTML content or subtypes
                is_html_subtype = getattr(message, "content_subtype", None) == "html"

                # Prepare payload for Resend SDK
                # Resend expects from, to, subject, and text/html bodies.
                resend_payload = {
                    "from": message.from_email or getattr(settings, "DEFAULT_FROM_EMAIL", "onboarding@receptify.in"),
                    "to": message.to,
                    "subject": message.subject,
                }

                # Handle text or HTML message body correctly
                if is_html_subtype:
                    resend_payload["html"] = message.body
                else:
                    resend_payload["text"] = message.body

                # Check for HTML content in alternative attachments (EmailMultiAlternatives)
                if hasattr(message, "alternatives") and message.alternatives:
                    for alternative in message.alternatives:
                        if alternative[1] == "text/html":
                            resend_payload["html"] = alternative[0]
                            break

                # Map optional carbon copy (CC) and blind carbon copy (BCC) headers if configured
                if getattr(message, "cc", None):
                    resend_payload["cc"] = message.cc
                if getattr(message, "bcc", None):
                    resend_payload["bcc"] = message.bcc

                # Send using official SDK
                resend.Emails.send(resend_payload)
                sent_count += 1
            except Exception as e:
                logger.error(f"Failed to send email through Resend: {str(e)}")
                if not self.fail_silently:
                    raise
        return sent_count
