"""Test the backend Retell client directly"""
import asyncio
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).resolve().parent
sys.path.insert(0, str(project_root))

# Load .env first
from dotenv import load_dotenv
env_path = project_root / ".env"
load_dotenv(env_path, override=True)

print("=== Testing Direct Backend Call ===")
from backend.retell import get_retell_client

async def test():
    client = get_retell_client()
    print(f"Client API Key: {client.api_key[:10]}... (length: {len(client.api_key)})")
    print(f"Client Agent ID: {client.agent_id}")
    
    try:
        result = await client.create_web_call()
        print(f"SUCCESS! Call ID: {result['call_id']}")
        print(f"Access token received: {bool(result['access_token'])}")
    except Exception as e:
        print(f"ERROR: {e}")

asyncio.run(test())