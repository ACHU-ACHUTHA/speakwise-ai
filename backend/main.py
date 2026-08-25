from fastapi import FastAPI
from pydantic import BaseModel

from backend.agent import chat_with_teacher


app = FastAPI(
    title="SpeakWise AI",
    description="AI English Learning Agent",
    version="0.1.0"
)


class ChatRequest(BaseModel):
    message: str


@app.get("/")
def root():
    return {
        "message": "SpeakWise AI backend is running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


@app.post("/chat")
def chat(request: ChatRequest):

    response = chat_with_teacher(request.message)

    return {
        "response": response
    }