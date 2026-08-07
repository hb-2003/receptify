"""Deterministic settings used by the automated test suite.

External work is executed inline so API and campaign-flow tests can assert the
final persisted state without requiring Redis, a Celery worker, or an email
provider.
"""

from .settings import *  # noqa: F403


EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# Never share the developer's ad-hoc test database. Django creates and removes
# this database for a clean, repeatable suite run.
DATABASES['default']['TEST'] = {'NAME': 'test_receptify_ci'}
