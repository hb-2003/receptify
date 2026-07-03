#!/usr/bin/env python3
import urllib.request
import base64
import json
import os

# Jira configuration
JIRA_URL = 'https://bhanderihardik11-1783017478652.atlassian.net'
EMAIL = 'bhanderihardik11@gmail.com'
TOKEN = os.environ.get('JIRA_API_TOKEN', 'mock_token_to_avoid_push_protection')

# Build basic authentication headers
auth_str = f'{EMAIL}:{TOKEN}'
auth_b64 = base64.b64encode(auth_str.encode('utf-8')).decode('utf-8')
headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': f'Basic {auth_b64}'
}

# Subtasks of Week 1 that are completed in our local codebase
COMPLETED_WEEK_1_SUBTASKS = [
    'KAN-7',   # DB migration
    'KAN-8',   # crypto.ts creation
    'KAN-9',   # Database Seed Update
    'KAN-12',  # Settings Twilio Form UI
    'KAN-13',  # POST /api/v1/business/twilio
    'KAN-14',  # Secure Credentials Retrieval Endpoint
    'KAN-15',  # WEEK 1 BUFFER & TESTING GATE (All tests passed 100%)
]

# Parent Task for Week 1 (to be set to 'In Progress')
PARENT_WEEK_1 = 'KAN-6'

def transition_issue(key, transition_id):
    url = f'{JIRA_URL}/rest/api/2/issue/{key}/transitions'
    payload = { 'transition': { 'id': str(transition_id) } }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers=headers,
        method='POST'
    )
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"Successfully transitioned {key} (Transition ID: {transition_id})")
    except Exception as e:
        if hasattr(e, 'read'):
            print(f"Error transitioning {key}: {e.read().decode('utf-8')}")
        else:
            print(f"Error transitioning {key}: {e}")

def main():
    print("Transitioning completed Receptify tickets to Done...")
    for key in COMPLETED_WEEK_1_SUBTASKS:
        transition_issue(key, 41) # Transition ID 41 is 'Done'
        
    print("\nTransitioning Week 1 Parent Task to 'In Progress'...")
    transition_issue(PARENT_WEEK_1, 21) # Transition ID 21 is 'In Progress'
    
    print("\nStatus transition complete!")

if __name__ == '__main__':
    main()
