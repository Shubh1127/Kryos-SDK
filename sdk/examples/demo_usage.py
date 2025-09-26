from kryos.client import KryosClient

# Initialize SDK with API key
client = KryosClient(api_key="demo-api-key-123")

# Example: Employee updates profile
company_payload = {
    "name": "Alice",
    "email": "alice@company.com",
    "role": "manager"
}

resp = client.log_event("USER_PROFILE_UPDATE", company_payload, user_id="U123")
print("Event logged to Kryos:", resp)
