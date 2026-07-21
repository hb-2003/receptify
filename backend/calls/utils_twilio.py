import base64
import httpx
from decouple import config
from receptify.crypto import decrypt
from calls.models import Call, CallEvent
from receptify.models import TwilioCredentials

def initiate_twilio_call(call_id: str) -> dict:
    try:
        call = Call.objects.get(id=call_id)
    except Call.DoesNotExist:
        return {'error': 'Call not found'}
        
    campaign = call.campaign
    customer = call.customer
    
    try:
        credentials = TwilioCredentials.objects.get(business_id=campaign.business_id)
    except TwilioCredentials.DoesNotExist:
        return {'error': 'No Twilio credentials configured for this business'}
        
    # Decrypt token
    try:
        decrypted_token = decrypt(credentials.auth_token)
    except Exception as e:
        return {'error': f'Failed to decrypt Auth Token: {str(e)}'}
        
    account_sid = credentials.account_sid
    twilio_number = credentials.phone_number
    
    if not twilio_number:
        return {'error': 'Twilio phone number is not configured'}

    # Construct auth
    auth_str = f"{account_sid}:{decrypted_token}"
    auth_b64 = base64.b64encode(auth_str.encode('utf-8')).decode('utf-8')
    headers = {
        'Authorization': f"Basic {auth_b64}",
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    
    # Target urls
    public_url = config('PUBLIC_APP_URL', default='https://api.receptify.in').rstrip('/')
    twiml_url = f"{public_url}/api/calls/{call.id}/twiml"
    status_url = f"{public_url}/api/calls/{call.id}/status"
    
    # Form data
    data = {
        'To': customer.phone,
        'From': twilio_number,
        'Url': twiml_url,
        'StatusCallback': status_url,
        'StatusCallbackMethod': 'POST',
    }
    
    # Twilio API URL
    twilio_url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Calls.json"
    
    # --- twilio calling pass ---
    # Trigger the real HTTP call request to Twilio's infrastructure.
    # We specify a strict 10.0-second network timeout so a hung connection
    # doesn't block our backend thread indefinitely.
    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.post(twilio_url, headers=headers, data=data)
            
            if response.status_code == 201 or response.status_code == 200:
                res_data = response.json()
                sid = res_data.get('sid')
                
                # Update call status to ringing since the dial was successful
                call.status = 'ringing'
                call.save()
                
                # Create a call event for tracking this active call
                CallEvent.objects.create(
                    call=call,
                    event_type='initiated',
                    payload=res_data
                )
                
                return {'success': True, 'sid': sid}
            else:
                err_text = response.text
                # Log a failure event so we can audit what went wrong with the carrier
                CallEvent.objects.create(
                    call=call,
                    event_type='failed',
                    payload={'status_code': response.status_code, 'error': err_text}
                )
                return {'error': f"Twilio API error ({response.status_code}): {err_text}"}
    except Exception as e:
        return {'error': f"Network or execution error: {str(e)}"}
