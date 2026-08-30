import asyncio
import httpx
from backend.config import RETELL_API_KEY, RETELL_AGENT_ID

async def test_endpoint():
    print('[TEST] Testing /retell/create-call endpoint')
    print(f'[TEST] RETELL_API_KEY configured: {bool(RETELL_API_KEY)}')
    print(f'[TEST] RETELL_AGENT_ID: {RETELL_AGENT_ID}')
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            'http://localhost:8000/retell/create-call',
            headers={'Content-Type': 'application/json'},
            timeout=30.0
        )
        print(f'[TEST] Response status: {response.status_code}')
        if response.status_code == 200:
            data = response.json()
            print(f'[TEST] Success! Call ID: {data.get("call_id")}')
            print(f'[TEST] Access token received: {bool(data.get("access_token"))}')
        else:
            print(f'[TEST] Error: {response.text}')

if __name__ == "__main__":
    asyncio.run(test_endpoint())