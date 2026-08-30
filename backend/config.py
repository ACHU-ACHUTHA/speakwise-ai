import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from the project root
env_path = Path(__file__).resolve().parent.parent / ".env"
print(f"[CONFIG] Looking for .env at: {env_path}")
print(f"[CONFIG] .env exists: {env_path.exists()}")

load_dotenv(env_path)

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATABASE_DIR = BASE_DIR / "database"
DATABASE_DIR.mkdir(parents=True, exist_ok=True)

# Database paths
DB_PATH = str(DATABASE_DIR / "teacher.db")
CHROMA_DB_DIR = str(DATABASE_DIR / "chroma_db")
ENGLISH_MATERIAL_DIR = DATA_DIR / "english_material"

# Gemini API configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
PRIMARY_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
FALLBACK_MODEL = "gemini-3.5-flash"
EMBEDDING_MODEL = "models/gemini-embedding-001"

# Retell AI configuration
RETELL_API_KEY = os.getenv("RETELL_API_KEY")
RETELL_AGENT_ID = os.getenv("RETELL_AGENT_ID")

# Secure logging for all configuration
print(f"[CONFIG] GEMINI_API_KEY configured: {bool(GEMINI_API_KEY)}")
print(f"[CONFIG] RETELL_API_KEY configured: {bool(RETELL_API_KEY)}")
print(f"[CONFIG] RETELL_AGENT_ID configured: {bool(RETELL_AGENT_ID)}")

if RETELL_AGENT_ID:
    print(f"[CONFIG] RETELL_AGENT_ID value: {RETELL_AGENT_ID}")
    expected_agent_id = "agent_bb60900558a77aa3e31b60c8cc"
    print(f"[CONFIG] Expected agent ID: {expected_agent_id}")
    print(f"[CONFIG] Agent ID matches: {RETELL_AGENT_ID == expected_agent_id}")
