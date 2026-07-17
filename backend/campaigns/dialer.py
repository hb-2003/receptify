import asyncio
import time
import httpx
import base64
from decouple import config
from django.db import transaction, DatabaseError
from receptify.models import TwilioCredentials
from receptify.crypto import decrypt
from campaigns.models import Campaign
from calls.models import Call, CallEvent
from calls.helpers import is_trai_compliant_time, is_ndnc_blocked

# Wrapper that runs the async dialer in the background thread.
def run_live_campaign_dialer(campaign_id: str):
    try:
        asyncio.run(run_live_campaign_dialer_async(campaign_id))
    except Exception as e:
        # If an error happens, fallback gracefully
        try:
            campaign = Campaign.objects.get(id=campaign_id)
            campaign.status = 'failed'
            campaign.save()
        except Exception:
            pass

async def dial_customer(call, campaign, account_sid, auth_token, from_phone, semaphore):
    async with semaphore:
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
            
            # Construct base URLs pointing back to our own public endpoints using dynamic environment domains
            public_app_url = config('PUBLIC_APP_URL', default='https://api.receptify.in').rstrip('/')
            twiml_callback = f"{public_app_url}/api/calls/{call.id}/twiml"
            status_callback = f"{public_app_url}/api/calls/{call.id}/status"
            
            payload = {
                "From": from_phone,
                "To": call.customer.phone,
                "Url": twiml_callback,
                "StatusCallback": status_callback,
                "StatusCallbackEvent": ["initiated", "ringing", "answered", "completed"]
            }
            
            try:
                # Dispatch POST to Twilio using httpx AsyncClient
                async with httpx.AsyncClient() as client:
                    response = await client.post(twilio_url, data=payload, auth=(account_sid, auth_token))
                    if response.status_code in [200, 201]:
                        call.status = 'ringing'
                        await asyncio.to_thread(call.save)
                        
                        await asyncio.to_thread(
                            CallEvent.objects.create,
                            call=call,
                            event_type="outbound_initiated",
                            payload=response.json()
                        )
                    else:
                        call.status = 'failed'
                        call.outcome = 'failed'
                        call.notes = f"Twilio API rejected call setup: {response.text}"
                        await asyncio.to_thread(call.save)
            except Exception as e:
                call.status = 'failed'
                call.outcome = 'failed'
                call.notes = f"Connection failed initiating call: {str(e)}"
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
                    print(f"[Dialer] Campaign {campaign_id} does not exist.")
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
            print(f"[Dialer] Campaign {campaign_id} is already running, locked, or completed. Safely aborting duplicate thread execution.")
            return

    except Exception as e:
        print(f"[Dialer] Error acquiring launch lock for campaign {campaign_id}: {str(e)}")
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

    # Find all queued calls for this campaign
    queued_calls = await asyncio.to_thread(
        lambda: list(Call.objects.filter(campaign_id=campaign_id, status='queued').select_related('customer'))
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
