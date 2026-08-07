import logging
import threading
from django.conf import settings
from calls.stt_service import transcribe_and_summarize_call

logger = logging.getLogger("receptify.calls.tasks")

try:
    from celery import shared_task
except ImportError:
    def shared_task(func=None, **kwargs):
        if func is None:
            return lambda f: f
        return func

@shared_task
def transcribe_and_summarize_call_task(call_id: str) -> None:
    """Celery task to transcribe and generate AI summaries for completed call recordings."""
    logger.info(f"Celery executing transcription and summary task for call {call_id}")
    transcribe_and_summarize_call(call_id)

def dispatch_transcribe_and_summarize(call_id: str) -> None:
    """
    Dispatches STT transcription and summarization via Celery task queue when Celery & Redis are operational,
    falling back seamlessly to a background daemon thread for local development.
    """
    if getattr(settings, 'CELERY_TASK_ALWAYS_EAGER', False):
        transcribe_and_summarize_call(call_id)
        return

    celery_dispatched = False
    try:
        if hasattr(transcribe_and_summarize_call_task, 'delay'):
            broker_url = getattr(settings, 'CELERY_BROKER_URL', '')
            if broker_url and ('redis://' in broker_url or 'rediss://' in broker_url):
                import redis
                r = redis.Redis.from_url(broker_url, socket_timeout=0.5)
                if r.ping():
                    transcribe_and_summarize_call_task.delay(call_id)
                    celery_dispatched = True
                    logger.info(f"Dispatched transcription for call {call_id} via Celery queue.")
    except Exception as e:
        logger.warning(f"Celery transcription dispatch failed for call {call_id}: {e}. Falling back to thread.")

    if not celery_dispatched:
        logger.info(f"Launching transcription for call {call_id} via local background thread.")
        t = threading.Thread(target=transcribe_and_summarize_call, args=(call_id,), daemon=True)
        t.start()
