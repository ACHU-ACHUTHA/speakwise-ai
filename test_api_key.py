import asyncio
import httpx
import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path('.env'))
api_key = os.getenv('RETELL_API_KEY')

print('API Key length:', len(api_key) if api_key else 0)
print('API Key starts with:', api_key[:10] + '...' if api_key else 'None')

async def test():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            'https://api.retellai.com/v2/create-web-call',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            },
            json={'agent_id': 'agent_bb60900558a77aa3e31b60c8cc'},
            timeout=30.0
        )
        print('Status:', response.status_code)
        print('Response:', response.text)

asyncio.run(test())