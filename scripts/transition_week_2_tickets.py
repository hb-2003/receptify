#!/usr/bin/env python3
import urllib.request
import base64
import json
import os

# Jira configuration
JIRA_URL = "https://bhanderihardik11-1783017478652.atlassian.net"
EMAIL = "bhanderihardik11@gmail.com"
TOKEN = os.environ.get("JIRA_API_TOKEN", "mock_token_to_avoid_push_protection")

# Build basic authentication headers
auth_str = f"{EMAIL}:{TOKEN}"
auth_b64 = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")
headers = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Authorization": f"Basic {auth_b64}"
}

# ALL 9 Week 2 Subtasks that are 100% completed and verified in the codebase
WEEK_2_SUBTASKS = [
    "KAN-17",  # Campaign Launch Routing
    "KAN-18",  # Python Cron Poller (Daemon Worker Thread)
    "KAN-19",  # Dialer Core (Twilio API placements)
    "KAN-20",  # Dial Concurrency Limit (asyncio.Semaphore(5))
    "KAN-21",  # Base TwiML Endpoint
    "KAN-22",  # Twilio Signature Verification (verify_twilio_signature)
    "KAN-23",  # Call Status Webhook (TwilioCallStatusView)
    "KAN-24",  # End-to-End Pipeline Trial (Tests verified)
    "KAN-25",  # WEEK 2 BUFFER & TESTING GATE (29/29 tests green)
]

def transition_issue(key, transition_id):
    url = f"{JIRA_URL}/rest/api/2/issue/{key}/transitions"
    payload = { "transition": { "id": str(transition_id) } }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"Successfully transitioned {key} (Transition ID: {transition_id})")
    except Exception as e:
        if hasattr(e, "read"):
            print(f"Error transitioning {key}: {e.read().decode('utf-8')}")
        else:
            print(f"Error transitioning {key}: {e}")

def main():
    if TOKEN == "mock_token_to_avoid_push_protection" or not TOKEN:
        print("Error: JIRA_API_TOKEN environment variable is not set.")
        print("Please run this script with your Atlassian API Token set:")
        print("  JIRA_API_TOKEN=your_jira_token_here python scripts/transition_week_2_tickets.py")
        return

    print("Transitioning all completed Week 2 Receptify tickets to In Review...")
    for key in WEEK_2_SUBTASKS:
        # Move to In Review (Transition ID 31)
        transition_issue(key, 31)
    
    print("\nWeek 2 JIRA transitions complete!")

if __name__ == "__main__":
    main()
