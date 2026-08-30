import uvicorn
from backend.main import app

if __name__ == "__main__":
    print("Starting SpeakWise AI FastAPI Server on http://localhost:8000 ...")
    print("Web UI available at: http://localhost:8000/app/")
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)