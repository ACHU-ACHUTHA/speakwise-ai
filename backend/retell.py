import os
import httpx
from pathlib import Path
from dotenv import load_dotenv

# Load .env file to ensure environment variables are available
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path)

# Import configuration after loading .env
from backend.config import RETELL_API_KEY, RETELL_AGENT_ID

class RetellClient:
    def __init__(self):
        # Reload environment variables to ensure we have the latest values
        from pathlib import Path
        from dotenv import load_dotenv
        import os
        env_path = Path(__file__).resolve().parent.parent / ".env"
        load_dotenv(env_path, override=True)
        
        # Get fresh values from environment
        self.api_key = os.getenv("RETELL_API_KEY")
        agent_id = os.getenv("RETELL_AGENT_ID")
        
        # Extract agent ID from full URL if provided
        self.agent_id = self._extract_agent_id(agent_id)
        self.base_url = "https://api.retellai.com/v2"
        
        print(f"[RETELL CLIENT] API Key configured: {bool(self.api_key)}")
        print(f"[RETELL CLIENT] API Key length: {len(self.api_key) if self.api_key else 0}")
        print(f"[RETELL CLIENT] API Key starts with: {self.api_key[:10] + '...' if self.api_key else 'None'}")
        print(f"[RETELL CLIENT] Agent ID configured: {bool(self.agent_id)}")
        print(f"[RETELL CLIENT] Agent ID: {self.agent_id}")
        print(f"[RETELL CLIENT] Using API base URL: {self.base_url}")
        
    def _extract_agent_id(self, agent_id):
        """Extract agent ID from full URL if provided"""
        if not agent_id:
            return None
            
        # If it's a full URL, extract just the agent ID
        if agent_id.startswith("http"):
            try:
                # Extract agent ID from URL like:
                # https://dashboard.retellai.com/agents/agent_bb60900558a77aa3e31b60c8cc
                parts = agent_id.split("/")
                for part in parts:
                    if part.startswith("agent_"):
                        print(f"[RETELL CLIENT] Extracted agent ID from URL: {part}")
                        return part
                # If no agent_ prefix found, use the last part
                last_part = parts[-1]
                print(f"[RETELL CLIENT] Using last part as agent ID: {last_part}")
                return last_part
            except Exception as e:
                print(f"[RETELL CLIENT] Error extracting agent ID: {e}")
                return agent_id
        
        return agent_id
        
    async def create_web_call(self):
        """Create a Retell web call and return the access token"""
        if not self.api_key:
            raise ValueError("RETELL_API_KEY not configured")
        if not self.agent_id:
            raise ValueError("RETELL_AGENT_ID not configured")
            
        print(f"[RETELL CLIENT] Creating web call for agent: {self.agent_id}")
        print(f"[RETELL CLIENT] Using API key: {self.api_key[:10]}... (length: {len(self.api_key)})")
            
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/create-web-call",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "agent_id": self.agent_id
                },
                timeout=30.0
            )
            
            print(f"[RETELL CLIENT] API response status: {response.status_code}")
            print(f"[RETELL CLIENT] Response content type: {response.headers.get('content-type')}")
            print(f"[RETELL CLIENT] Response content length: {len(response.content)}")
            
            if response.status_code not in [200, 201]:
                print(f"[RETELL CLIENT] Raw response: {response.text[:500]}")
                try:
                    error_data = response.json() if response.content else {}
                except:
                    error_data = {"raw_response": response.text[:500]}
                print(f"[RETELL CLIENT] API error: {error_data}")
                raise Exception(f"Retell API error: {response.status_code} - {error_data}")
                
            try:
                data = response.json()
            except Exception as e:
                print(f"[RETELL CLIENT] JSON parsing error: {e}")
                print(f"[RETELL CLIENT] Raw response: {response.text[:500]}")
                raise Exception(f"Retell API returned invalid JSON: {e}")
                
            print(f"[RETELL CLIENT] Web call created successfully, call ID: {data.get('call_id')}")
            
            return {
                "access_token": data.get("access_token"),
                "call_id": data.get("call_id")
            }

# Global Retell client instance (lazy-loaded)
retell_client = None

def get_retell_client():
    """Get or create the Retell client instance"""
    global retell_client
    if retell_client is None:
        retell_client = RetellClient()
    return retell_client