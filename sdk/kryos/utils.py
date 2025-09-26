import hashlib
import json


def generate_hash(payload: dict) -> str:
    """
    Utility function to create SHA256 hash from payload
    """
    serialized = json.dumps(payload, sort_keys=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()
