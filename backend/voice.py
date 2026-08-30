import os
import tempfile
import base64
import time
from gtts import gTTS
import speech_recognition as sr
from google import genai
from google.genai import types
from backend.config import GEMINI_API_KEY, PRIMARY_MODEL

def speech_to_text(audio_bytes: bytes, filename: str = "recording.webm") -> str:
    """
    Convert speech audio bytes into text.
    Uses instant Gemini inline audio processing with SpeechRecognition fallback for WAV.
    
    Returns:
        Transcribed text string (may be empty string if no speech detected).
    
    Raises:
        ValueError: If STT processing fails completely (API error, not just silence).
    """
    t0 = time.time()
    print(f"[VOICE STT] Processing audio size: {len(audio_bytes)} bytes, filename: {filename}", flush=True)
    
    temp_dir = tempfile.gettempdir()
    temp_path = os.path.join(temp_dir, filename)
    
    with open(temp_path, "wb") as f:
        f.write(audio_bytes)
        
    transcript = ""
    
    # 1. Try SpeechRecognition ONLY if valid RIFF WAV header
    if filename.lower().endswith(".wav") and audio_bytes[:4] == b"RIFF":
        recognizer = sr.Recognizer()
        try:
            with sr.AudioFile(temp_path) as source:
                audio_data = recognizer.record(source)
                transcript = recognizer.recognize_google(audio_data)
                if transcript.strip():
                    elapsed = int((time.time() - t0) * 1000)
                    print(f"[VOICE STT] SpeechRecognition Success ({elapsed} ms): '{transcript}'", flush=True)
                    return transcript.strip()
        except Exception as e:
            print("[VOICE STT] SpeechRecognition attempt skipped/failed:", str(e), flush=True)

    # 2. Gemini Inline Audio STT (Supports webm, wav, mp3, ogg, m4a)
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        ext = filename.split(".")[-1].lower()
        
        mime_type = "audio/webm"
        if ext == "wav":
            mime_type = "audio/wav"
        elif ext in ["mp3", "mpeg"]:
            mime_type = "audio/mp3"
        elif ext in ["ogg"]:
            mime_type = "audio/ogg"
        elif ext in ["m4a", "mp4"]:
            mime_type = "audio/mp4"

        audio_part = types.Part.from_bytes(
            data=audio_bytes,
            mime_type=mime_type
        )
        
        response = client.models.generate_content(
            model=PRIMARY_MODEL,
            contents=[
                audio_part, 
                "Transcribe this spoken English audio recording accurately. Return ONLY the transcribed text without extra formatting or commentary. If there is no speech or the audio is silent, return an empty string."
            ]
        )
        if response.text:
            raw = response.text.strip()
            # Treat model refusals / "no speech" signals as empty
            no_speech_signals = {"", "no speech", "no speech detected", "silent", "[silence]", "[no speech]"}
            if raw.lower() in no_speech_signals:
                elapsed = int((time.time() - t0) * 1000)
                print(f"[VOICE STT] Gemini detected no speech ({elapsed} ms)", flush=True)
                return ""
            transcript = raw
            elapsed = int((time.time() - t0) * 1000)
            print(f"[VOICE STT] Gemini Audio Success ({elapsed} ms): '{transcript}'", flush=True)
        else:
            # Empty response — no speech detected
            elapsed = int((time.time() - t0) * 1000)
            print(f"[VOICE STT] Gemini returned empty response ({elapsed} ms) — no speech", flush=True)
            return ""
            
    except Exception as err:
        print("[VOICE STT] Gemini Audio error:", str(err), flush=True)
        raise ValueError(f"Speech-to-text failed: {str(err)}") from err
        
    return transcript

def text_to_speech_base64(text: str, lang: str = "en") -> str:
    """
    Convert text response to speech MP3 and return base64 encoded audio string.
    Returns empty string on failure (TTS failure is non-fatal).
    """
    t0 = time.time()
    print(f"[VOICE TTS] Generating audio for text ({len(text)} chars)...", flush=True)
    try:
        # Limit text length for fast TTS generation
        tts_text = text[:400] if len(text) > 400 else text
        tts = gTTS(text=tts_text, lang=lang, slow=False)
        
        temp_dir = tempfile.gettempdir()
        mp3_path = os.path.join(temp_dir, "response.mp3")
        tts.save(mp3_path)
        
        with open(mp3_path, "rb") as f:
            audio_data = f.read()
            
        elapsed = int((time.time() - t0) * 1000)
        b64_str = base64.b64encode(audio_data).decode("utf-8")
        print(f"[VOICE TTS] Audio generated ({elapsed} ms), base64 len: {len(b64_str)}", flush=True)
        return b64_str
    except Exception as e:
        print("[VOICE TTS] Generation error:", str(e), flush=True)
        return ""
