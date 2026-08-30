import time
import sys
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional

from backend.agent import chat_with_teacher, is_simple_conversational
from backend.rag import get_rag_context, reindex_rag
from backend.memory import get_learner_profile_db, get_mistakes_db
from backend.voice import speech_to_text, text_to_speech_base64
from backend.config import BASE_DIR
from backend.retell import RetellClient

app = FastAPI(
    title="SpeakWise AI",
    description="Personal AI English Teacher Backend API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def safe_print(*args, **kwargs):
    """
    Safely print text to stdout without UnicodeEncodeError on Windows (cp1252).
    """
    new_args = []
    for arg in args:
        if isinstance(arg, str):
            new_args.append(arg.encode(sys.stdout.encoding or 'utf-8', errors='replace').decode(sys.stdout.encoding or 'utf-8'))
        else:
            new_args.append(arg)
    print(*new_args, **kwargs)

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = "default"

class TTSRequest(BaseModel):
    text: str

@app.get("/")
def root():
    return {"message": "SpeakWise AI backend is running"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.post("/chat")
def chat(request: ChatRequest):
    t_start = time.time()
    try:
        user_msg = request.message.strip() if request.message else ""
        if not user_msg:
            return {
                "response": "Please type or speak a message!",
                "message_type": "text",
                "session_id": request.session_id
            }

        context = ""
        if not is_simple_conversational(user_msg):
            context = get_rag_context(user_msg)

        teacher_response = chat_with_teacher(
            user_message=user_msg,
            session_id=request.session_id,
            extra_context=context
        )
        
        total_ms = int((time.time() - t_start) * 1000)
        safe_print(f"[TIME] [/chat] Processed message in {total_ms} ms", flush=True)

        return {
            "response": teacher_response,
            "message_type": "text",
            "session_id": request.session_id
        }
    except Exception as e:
        safe_print("[ERROR] in /chat:", str(e), flush=True)
        return {
            "response": "I had a quick glitch, but I am here! How can I help you practice your English?",
            "message_type": "text",
            "session_id": request.session_id
        }

@app.post("/voice/chat")
async def voice_chat(
    file: UploadFile = File(...),
    session_id: str = Form("default")
):
    t_start = time.time()
    safe_print("=" * 50, flush=True)
    
    filename = file.filename or "recording.webm"
    safe_print(f"[BACKEND] FastAPI received file: {filename}", flush=True)
    
    try:
        audio_bytes = await file.read()
        
        safe_print(f"[BACKEND] File size on backend: {len(audio_bytes)} bytes", flush=True)

        # STT request
        safe_print("[BACKEND] STT request started", flush=True)
        t_stt = time.time()
        try:
            transcript = speech_to_text(audio_bytes, filename=filename)
        except ValueError as stt_err:
            # True STT API failure
            safe_print(f"[BACKEND] STT failed with error: {stt_err}", flush=True)
            raise HTTPException(
                status_code=500,
                detail={"error": "stt_failed", "message": "Speech recognition failed. Please try again."}
            )
        
        stt_ms = int((time.time() - t_stt) * 1000)
        safe_print(f"[BACKEND] STT result: transcript = '{transcript}' | duration = {stt_ms} ms", flush=True)

        # Empty transcript = no speech detected in the audio
        if not transcript or not transcript.strip():
            safe_print("[BACKEND] No speech detected in audio", flush=True)
            raise HTTPException(
                status_code=422,
                detail={"error": "no_speech", "message": "No speech detected. Please try again."}
            )

        # Get RAG Context
        context = ""
        if not is_simple_conversational(transcript):
            context = get_rag_context(transcript)

        # Agent request
        safe_print("[BACKEND] Agent request started", flush=True)
        t_agent = time.time()
        teacher_response = chat_with_teacher(
            user_message=transcript,
            session_id=session_id,
            extra_context=context
        )
        agent_ms = int((time.time() - t_agent) * 1000)
        
        safe_print(f"[BACKEND] Agent response: '{teacher_response}' | duration = {agent_ms} ms", flush=True)

        # TTS request — non-fatal, returns "" on failure
        safe_print("[BACKEND] TTS request started", flush=True)
        t_tts = time.time()
        audio_b64 = text_to_speech_base64(teacher_response)
        tts_ms = int((time.time() - t_tts) * 1000)
        
        audio_url = f"data:audio/mp3;base64,{audio_b64}" if audio_b64 else ""
        tts_status = "success" if audio_b64 else "failed (non-fatal)"
        safe_print(f"[BACKEND] TTS {tts_status} | duration = {tts_ms} ms", flush=True)
        
        total_ms = int((time.time() - t_start) * 1000)
        safe_print(f"[BACKEND] TOTAL PIPELINE TIME: {total_ms} ms", flush=True)
        safe_print("=" * 50, flush=True)

        return {
            "transcript": transcript,
            "response": teacher_response,
            "audio_url": audio_url,
            "tts_ok": bool(audio_b64)
        }
    except HTTPException:
        # Re-raise HTTP exceptions as-is (no_speech, stt_failed)
        raise
    except Exception as e:
        safe_print("[BACKEND] [ERROR] voice_chat unexpected exception:", str(e), flush=True)
        raise HTTPException(
            status_code=500,
            detail={"error": "server_error", "message": "An unexpected error occurred. Please try again."}
        )

@app.post("/voice/tts")
def voice_tts(request: TTSRequest):
    """Generate TTS audio for an existing teacher response (retry after TTS failure)."""
    text = (request.text or "").strip()
    if not text:
        raise HTTPException(
            status_code=400,
            detail={"error": "empty_text", "message": "No text provided for speech synthesis."}
        )
    audio_b64 = text_to_speech_base64(text)
    if not audio_b64:
        raise HTTPException(
            status_code=500,
            detail={"error": "tts_failed", "message": "Could not generate audio. Please try again."}
        )
    return {
        "audio_url": f"data:audio/mp3;base64,{audio_b64}",
        "tts_ok": True
    }

@app.get("/memory/profile")
def get_profile():
    return get_learner_profile_db()

@app.get("/memory/mistakes")
def get_mistakes(limit: int = 10):
    return get_mistakes_db(limit=limit)

@app.post("/rag/reindex")
def reindex():
    msg = reindex_rag()
    return {"message": msg}

@app.post("/retell/create-call")
async def create_retell_call():
    """Create a Retell web call and return access token for frontend"""
    print("[RETELL] /retell/create-call called")
    
    try:
        # Load environment variables directly in the endpoint
        from pathlib import Path
        from dotenv import load_dotenv
        import os
        import httpx
        
        env_path = Path(__file__).resolve().parent.parent / ".env"
        load_dotenv(env_path, override=True)
        
        api_key = os.getenv("RETELL_API_KEY")
        agent_id = os.getenv("RETELL_AGENT_ID")
        
        print(f"[RETELL] API key configured: {bool(api_key)}")
        print(f"[RETELL] Agent ID configured: {bool(agent_id)}")
        print(f"[RETELL] Agent ID: {agent_id}")
        
        if not api_key:
            print("[RETELL] ERROR: RETELL_API_KEY not configured")
            raise ValueError("RETELL_API_KEY not configured")
        if not agent_id:
            print("[RETELL] ERROR: RETELL_AGENT_ID not configured")
            raise ValueError("RETELL_AGENT_ID not configured")
        
        print(f"[RETELL] Calling Retell API with agent: {agent_id}")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.retellai.com/v2/create-web-call",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={"agent_id": agent_id},
                timeout=30.0
            )
            
            print(f"[RETELL] API response status: {response.status_code}")
            
            if response.status_code not in [200, 201]:
                print(f"[RETELL] API request failed")
                print(f"[RETELL] Status: {response.status_code}")
                print(f"[RETELL] Response: {response.text[:500]}")
                raise HTTPException(
                    status_code=500,
                    detail={
                        "error": "retell_api_error",
                        "status": response.status_code,
                        "details": response.text[:500]
                    }
                )
            
            data = response.json()
            print(f"[RETELL] Web call created successfully, call ID: {data.get('call_id')}")
            return {
                "access_token": data.get("access_token"),
                "call_id": data.get("call_id")
            }
            
    except ValueError as e:
        print(f"[RETELL] Configuration error: {str(e)}")
        raise HTTPException(status_code=500, detail={"error": "config_error", "message": str(e)})
    except HTTPException:
        raise
    except Exception as e:
        print(f"[RETELL] Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail={"error": "server_error", "message": str(e)})

# Mount frontend directory for browser UI
frontend_dir = BASE_DIR / "frontend"
if frontend_dir.exists():
    app.mount("/app", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")