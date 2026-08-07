import logging
import threading
from django.conf import settings
from campaigns.dialer import run_live_campaign_dialer

logger = logging.getLogger("receptify.campaigns.tasks")

try:
    from celery import shared_task
except ImportError:
    # Dummy shared_task decorator if celery is not installed
    def shared_task(func=None, **kwargs):
        if func is None:
            return lambda f: f
        return func

@shared_task
def run_live_campaign_dialer_task(campaign_id: str) -> None:
    """Celery background task for initiating live or simulated campaign calls."""
    logger.info(f"Celery executing campaign dialer for campaign {campaign_id}")
    run_live_campaign_dialer(campaign_id)

@shared_task
def launch_scheduled_campaigns_task() -> None:
    """Celery periodic task for launching due scheduled campaigns."""
    from campaigns.models import Campaign
    from django.utils import timezone
    due_campaigns = Campaign.objects.filter(status='scheduled', scheduled_at__lte=timezone.now())
    for campaign in due_campaigns:
        campaign.status = 'active'
        campaign.save()
        dispatch_campaign_dialer(str(campaign.id))

def dispatch_campaign_dialer(campaign_id: str) -> None:
    """
    Dispatches campaign dialer via Celery task queue when Celery & Redis are operational,
    falling back seamlessly to a background daemon thread for local development.
    """
    # The Celery package is optional in local development. Honour eager mode
    # ourselves as well, so the test suite remains deterministic when Celery
    # is not installed and the fallback implementation is in use.
    if getattr(settings, 'CELERY_TASK_ALWAYS_EAGER', False):
        run_live_campaign_dialer(campaign_id)
        return

    celery_dispatched = False
    try:
        if hasattr(run_live_campaign_dialer_task, 'delay'):
            broker_url = getattr(settings, 'CELERY_BROKER_URL', '')
            if broker_url and ('redis://' in broker_url or 'rediss://' in broker_url):
                import redis
                r = redis.Redis.from_url(broker_url, socket_timeout=0.5)
                if r.ping():
                    run_live_campaign_dialer_task.delay(campaign_id)
                    celery_dispatched = True
                    logger.info(f"Dispatched campaign {campaign_id} via Celery queue.")
    except Exception as e:
        logger.warning(f"Celery dispatch failed for campaign {campaign_id}: {e}. Falling back to thread.")

    if not celery_dispatched:
        logger.info(f"Launching campaign {campaign_id} via local background thread.")
        t = threading.Thread(target=run_live_campaign_dialer, args=(campaign_id,), daemon=True)
        t.start()
