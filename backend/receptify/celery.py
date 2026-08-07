import os
import logging

logger = logging.getLogger("receptify.celery")

# Set default Django settings module for 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'receptify.settings')

try:
    from celery import Celery
    app = Celery('receptify')
    app.config_from_object('django.conf:settings', namespace='CELERY')
    app.autodiscover_tasks()
except ImportError:
    logger.info("Celery package is not installed; falling back to threading dispatch.")
    app = None
