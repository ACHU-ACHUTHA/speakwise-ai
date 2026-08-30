"""Test backend configuration directly"""
import sys
import os
from pathlib import Path

# Add project root to path
project_root = Path(__file__).resolve().parent
sys.path.insert(0, str(project_root))

# Load .env
from dotenv import load_dotenv
env_path = project_root / ".env"
load_dotenv(env_path, override=True)

print("=== Testing Backend Configuration ===")
print(f".env path: {env_path}")
print(f".env exists: {env_path.exists()}")

api_key = os.getenv("RETELL_API_KEY")
agent_id = os.getenv("RETELL_AGENT_ID")

print(f"RETELL_API_KEY: {bool(api_key)}")
print(f"RETELL_API_KEY length: {len(api_key) if api_key else 0}")
print(f"RETELL_API_KEY starts with: {api_key[:10] + '...' if api_key else 'None'}")
print(f"RETELL_AGENT_ID: {agent_id}")

# Now test the actual import
print("\n=== Testing Backend Import ===")
from backend.config import RETELL_API_KEY, RETELL_AGENT_ID
print(f"Config RETELL_API_KEY: {bool(RETELL_API_KEY)}")
print(f"Config RETELL_API_KEY length: {len(RETELL_API_KEY) if RETELL_API_KEY else 0}")
print(f"Config RETELL_API_KEY starts with: {RETELL_API_KEY[:10] + '...' if RETELL_API_KEY else 'None'}")
print(f"Config RETELL_AGENT_ID: {RETELL_AGENT_ID}")

# Test the client
print("\n=== Testing Retell Client ===")
from backend.retell import get_retell_client
client = get_retell_client()
print(f"Client API Key: {bool(client.api_key)}")
print(f"Client API Key length: {len(client.api_key) if client.api_key else 0}")
print(f"Client API Key starts with: {client.api_key[:10] + '...' if client.api_key else 'None'}")
print(f"Client Agent ID: {client.agent_id}")