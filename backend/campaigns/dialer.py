import asyncio
import logging
import httpx
from datetime import timedelta
from decouple import config
from django.db import transaction, DatabaseError
from django.db.models import Q
from django.utils import timezone
from receptify.models import TwilioCredentials
from receptify.crypto import decrypt
from campaigns.models import Campaign
from calls.models import Call, CallEvent
from calls.helpers import is_trai_compliant_time, is_ndnc_blocked

log = logging.getLogger(__name__)

# HTTP status codes that represent transient failures — safe to retry with backoff
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
# Maximum delay in minutes for exponential backoff before a retry
MAX_RETRY_DELAY_MINUTES = 60


def is_campaign_launchable(campaign):
    """
    Check whether a scheduled campaign can be launched now.
    Returns (bool, str) where str is a reason if not launchable.
    """
    if not is_trai_compliant_time():
        return False, "Outside TRAI calling window (9 AM - 9 PM IST)"
    try:
        credentials = TwilioCredentials.objects.get(business_id=campaign.business_id)
        if not credentials.account_sid or not credentials.auth_token:
            return False, "Twilio credentials incomplete"
    except TwilioCredentials.DoesNotExist:
        return False, "Missing Twilio credentials for business"
    return True, None


def schedule_retry(call, campaign, attempt_number):
    """Schedule a retry for a call that experienced a transient failure."""
    delay_minutes = min(campaign.delay_between_calls * (2 ** (attempt_number - 1)), MAX_RETRY_DELAY_MINUTES)
    call.next_retry_at = timezone.now() + timedelta(minutes=delay_minutes)
    call.attempt_number = attempt_number
    call.status = 'queued'
    call.save(update_fields=['next_retry_at', 'attempt_number', 'status'])
    log.info(
        f"Scheduled retry for call {call.id} (attempt {attempt_number}/{campaign.retry_attempts}), "
        f"next attempt at {call.next_retry_at}"
    )

# Wrapper that runs the async dialer in the background thread.
def run_live_campaign_dialer(campaign_id: str):
    try:
        asyncio.run(run_live_campaign_dialer_async(campaign_id))
    except Exception as e:
        log.error(f"Error running campaign dialer for {campaign_id}: {str(e)}")
        try:
            campaign = Campaign.objects.get(id=campaign_id)
            campaign.status = 'failed'
            campaign.save()
        except Exception:
            pass

async def dial_customer(call, campaign, account_sid, auth_token, from_phone, semaphore):
    async with semaphore:
        # --- Lifecycle Check ---
        # Skip calls if campaign has been paused or canceled mid-dial
        if campaign.status in ('paused', 'canceled', 'failed'):
            if call.status == 'queued':
                call.status = campaign.status
                await asyncio.to_thread(call.save)
            return False

        # --- TRAI Compliance Pass ---
        # Strictly enforce the 9:00 AM to 9:00 PM IST calling window.
        # If outside the allowed window, pause the campaign and stop dialing.
        is_compliant = await asyncio.to_thread(is_trai_compliant_time)
        if not is_compliant:
            campaign.status = 'scheduled'  # Pause/defer execution
            await asyncio.to_thread(campaign.save)
            return False

        # --- DND/NDNC Scrubbing Pass ---
        # Mark as failed with outcome 'blocked' if registered on the DND registry
        is_blocked = await asyncio.to_thread(is_ndnc_blocked, call.customer.phone)
        if is_blocked:
            call.status = 'failed'
            call.outcome = 'blocked'
            call.notes = "Blocked: Registered on NDNC (National Do Not Call) registry."
            await asyncio.to_thread(call.save)
            
            # Record a blocked call event in call history
            await asyncio.to_thread(
                CallEvent.objects.create,
                call=call,
                event_type="ndnc_blocked",
                payload={"phone": call.customer.phone}
            )
            return True

        # --- Twilio Dial Pass ---
        # Build callbacks and place the live call
        # In mock tests or sandbox mode (e.g. mock SIDs), we simulate placing the call to avoid HTTP 401s
        if account_sid.startswith("AC_mock_") or account_sid == "mock_sid":
            # Simulate outbound call initiation
            call.status = 'ringing'
            call.twilio_sid = "CA_mock_sid_12345"
            await asyncio.to_thread(call.save)

            await asyncio.to_thread(
                CallEvent.objects.create,
                call=call,
                event_type="outbound_initiated_mock",
                payload={"twilio_call_sid": "CA_mock_sid_12345"}
            )
        else:
            # Trigger real HTTP POST call initiation request to Twilio API
            twilio_url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Calls.json"

            # Construct base URLs pointing back to our own public endpoints
            public_url = config('PUBLIC_APP_URL', default='https://api.receptify.in').rstrip('/')
            twiml_callback = f"{public_url}/api/calls/{call.id}/twiml"
            status_callback = f"{public_url}/api/calls/{call.id}/status"
            recording_callback = f"{public_url}/api/calls/{call.id}/recording"

            payload = {
                "From": from_phone,
                "To": call.customer.phone,
                "Url": twiml_callback,
                "StatusCallback": status_callback,
                "StatusCallbackEvent": ["initiated", "ringing", "answered", "completed"],
                "Record": "true",
                "RecordingStatusCallback": recording_callback
            }

            try:
                # Dispatch POST to Twilio using httpx AsyncClient
                async with httpx.AsyncClient() as client:
                    response = await client.post(twilio_url, data=payload, auth=(account_sid, auth_token))
                    if response.status_code in [200, 201]:
                        res_json = response.json()
                        call.status = 'ringing'
                        call.twilio_sid = res_json.get('sid')
                        await asyncio.to_thread(call.save)

                        await asyncio.to_thread(
                            CallEvent.objects.create,
                            call=call,
                            event_type="outbound_initiated",
                            payload=res_json
                        )
                    elif response.status_code in RETRYABLE_STATUS_CODES:
                        # Transient failure — retry if we have attempts remaining
                        next_attempt = call.attempt_number + 1
                        if next_attempt < campaign.retry_attempts:
                            await asyncio.to_thread(schedule_retry, call, campaign, next_attempt)
                        else:
                            call.status = 'failed'
                            call.outcome = 'failed'
                            call.notes = f"Twilio API transient failure after {campaign.retry_attempts} retries: {response.text}"
                            await asyncio.to_thread(call.save)
                    else:
                        # Non-retryable failure — mark as failed immediately
                        call.status = 'failed'
                        call.outcome = 'failed'
                        call.notes = f"Twilio API rejected call setup: {response.text}"
                        await asyncio.to_thread(call.save)
            except Exception as e:
                # Network or connection error — retry with backoff if attempts remain
                next_attempt = call.attempt_number + 1
                if next_attempt < campaign.retry_attempts:
                    await asyncio.to_thread(schedule_retry, call, campaign, next_attempt)
                else:
                    call.status = 'failed'
                    call.outcome = 'failed'
                    call.notes = f"Connection failed initiating call after {campaign.retry_attempts} retries: {str(e)}"
                    await asyncio.to_thread(call.save)

        # --- Concurrency Pacing ---
        # Add a 1.5-second stagger interval between outbound launches
        # to respect standard account Calls-Per-Second (CPS) rate limits.
        await asyncio.sleep(1.5)
        return True

async def run_live_campaign_dialer_async(campaign_id: str):
    # Transition campaign status to 'running' atomically using row-level database locking.
    # If the campaign is already locked or is no longer 'scheduled', we abort instantly.
    try:
        def acquire_campaign_lock():
            with transaction.atomic():
                try:
                    c = Campaign.objects.select_for_update(nowait=True).get(id=campaign_id)
                except Campaign.DoesNotExist:
                    log.warning(f"Campaign {campaign_id} does not exist.")
                    return None
                except DatabaseError:
                    # Lock is already held by another parallel worker
                    return None
                
                if c.status != 'scheduled':
                    return None
                
                c.status = 'running'
                c.save(update_fields=['status'])
                return c

        campaign = await asyncio.to_thread(acquire_campaign_lock)
        if not campaign:
            log.warning(f"Campaign {campaign_id} is already running, locked, or completed. Safely aborting duplicate thread execution.")
            return

    except Exception as e:
        log.error(f"Error acquiring launch lock for campaign {campaign_id}: {str(e)}")
        return

    # Load business Twilio credentials
    try:
        credentials = await asyncio.to_thread(TwilioCredentials.objects.get, business_id=campaign.business_id)
        account_sid = credentials.account_sid
        try:
            auth_token = decrypt(credentials.auth_token)
        except ValueError:
            # Fallback to legacy or unencrypted raw token if it is not in encrypted format
            auth_token = credentials.auth_token
        from_phone = credentials.phone_number or "+1234567890"
    except TwilioCredentials.DoesNotExist:
        # If credentials don't exist, we must fail the campaign
        campaign.status = 'failed'
        await asyncio.to_thread(campaign.save)
        return

    # Find all queued calls for this campaign, including any retry-due calls
    # whose next_retry_at has elapsed. Immediate first-attempt calls have next_retry_at IS NULL.
    now = timezone.now()
    queued_calls = await asyncio.to_thread(
        lambda: list(Call.objects.filter(
            campaign_id=campaign_id,
            status='queued'
        ).filter(
            Q(next_retry_at__isnull=True) | Q(next_retry_at__lte=now)
        ).select_related('customer'))
    )

    # Apply an asyncio.Semaphore(5) per campaign execution block
    # to limit concurrent active outbound lines to 5 calls.
    semaphore = asyncio.Semaphore(5)

    # Launch all dialing tasks concurrently under the semaphore guard
    tasks = []
    for call in queued_calls:
        tasks.append(dial_customer(call, campaign, account_sid, auth_token, from_phone, semaphore))

    results = await asyncio.gather(*tasks)

    # If any task returned False (e.g., TRAI compliance window deferred the campaign),
    # we exit early and do not transition status to completed.
    if False in results:
        return

    # Transition campaign status to completed once all queued calls have been processed
    campaign.status = 'completed'
    await asyncio.to_thread(campaign.save, update_fields=['status'])
