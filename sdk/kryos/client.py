import os
import hashlib
import requests
import json
from datetime import datetime


class KryosClient:
    def __init__(self, api_key: str = None, base_url: str = "http://localhost:5000"):
        """
        Initialize Kryos Client
        """
        self.api_key = api_key or os.getenv("KRYOS_API_KEY")
        self.base_url = base_url
        if not self.api_key:
            raise ValueError("API key is required for KryosClient")

    def _hash_payload(self, payload: dict) -> str:
        """
        Generate SHA256 hash for given payload
        """
        serialized = json.dumps(payload, sort_keys=True)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    def log_event(self, event_type: str, payload: dict, user_id: str):
        """
        Send event hash + metadata to Kryos backend
        """
        event_hash = self._hash_payload(payload)
        metadata = {
            "event_type": event_type,
            "user_id": user_id,
            "hash": event_hash,
            "timestamp": datetime.utcnow().isoformat()
        }

        headers = {"Authorization": f"Bearer {self.api_key}"}
        resp = requests.post(f"{self.base_url}/events", json=metadata, headers=headers)

        if resp.status_code == 200:
            return resp.json()
        else:
            raise Exception(f"Kryos API Error: {resp.status_code} - {resp.text}")
