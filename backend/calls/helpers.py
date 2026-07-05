import datetime

# Checks if the current Indian Standard Time (IST) is within the legal calling window
# mandated by TRAI (9:00 AM to 9:00 PM).
def is_trai_compliant_time() -> bool:
    # Convert the current UTC time to India Standard Time (IST) which is UTC+5:30
    tz_ist = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
    now_ist = datetime.datetime.now(tz_ist)
    
    # TRAI legally restricts telemarketing calls to the 9:00 AM to 9:00 PM window
    start_time = now_ist.replace(hour=9, minute=0, second=0, microsecond=0)
    end_time = now_ist.replace(hour=21, minute=0, second=0, microsecond=0)
    
    return start_time <= now_ist <= end_time


# Checks if a phone number is registered on the National Do Not Call (NDNC) registry.
# In a real system this would query an official registry database, but for our prototype
# we use a local pattern check to simulate this filter reliably.
def is_ndnc_blocked(phone_number: str) -> bool:
    # Clean up formatting to isolate the digits
    clean_number = "".join(filter(str.isdigit, phone_number))
    
    # We block any number that ends in "00" or is explicitly in our mock blocklist
    mock_blocklist = ["919876543210", "919000000000"]
    
    if clean_number in mock_blocklist or clean_number.endswith("00"):
        return True
        
    return False
