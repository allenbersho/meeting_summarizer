import os
import sys
import json
import time
import uuid
import shutil
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# Optional imports for AI providers
try:
    from google import genai
    from google.genai import types
    HAS_GEMINI_SDK = True
except ImportError:
    HAS_GEMINI_SDK = False

try:
    from openai import OpenAI, OpenAIError
    HAS_OPENAI_SDK = True
except ImportError:
    HAS_OPENAI_SDK = False

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("meeting_summarizer")

# Load environment variables from .env file
load_dotenv()

# Base directory resolution for reliable dynamic file paths across OS platforms
BASE_DIR = Path(__file__).parent.resolve()
STATIC_DIR = BASE_DIR / "static"
DATA_DIR = BASE_DIR / "data" / "summaries"
TEMP_AUDIO_DIR = BASE_DIR / "temp_audio"

# Ensure runtime directories exist safely
DATA_DIR.mkdir(parents=True, exist_ok=True)
TEMP_AUDIO_DIR.mkdir(parents=True, exist_ok=True)

# Configuration Constants
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "35"))
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".webm", ".ogg", ".flac", ".mp4"}

# Initialize FastAPI App
app = FastAPI(
    title="Meeting Summarizer API",
    description="Automated meeting audio transcription and action-oriented summary generator.",
    version="1.1.0"
)

# Enable CORS for local development flexibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_active_provider() -> str:
    """
    Determines active provider: 'gemini', 'openai', or 'demo'.
    """
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and gemini_key.strip() and gemini_key != "your_free_gemini_api_key_here":
        return "gemini"
    
    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key and openai_key.strip() and openai_key != "your_openai_api_key_here":
        return "openai"

    return "demo"

def validate_audio_file(file: UploadFile) -> str:
    """
    Validates file extension and filename safety.
    Returns extension string if valid.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file has no valid filename."
        )
    
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        allowed_str = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{file_ext}'. Allowed formats: {allowed_str}"
        )
    
    return file_ext

@app.get("/api/health")
def health_check():
    """
    Health check endpoint verifying server status, active provider, and storage info.
    """
    provider = get_active_provider()
    saved_count = len(list(DATA_DIR.glob("*.json")))
    
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "active_provider": provider,
        "gemini_sdk_installed": HAS_GEMINI_SDK,
        "openai_sdk_installed": HAS_OPENAI_SDK,
        "max_file_size_mb": MAX_FILE_SIZE_MB,
        "total_summaries_saved": saved_count
    }

async def process_with_gemini(file_path: Path) -> Dict[str, Any]:
    """
    Processes audio directly using 100% Free Google Gemini API (gemini-1.5-flash).
    """
    if not HAS_GEMINI_SDK:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="google-genai SDK is not installed. Please run: pip install google-genai"
        )
    
    gemini_key = os.getenv("GEMINI_API_KEY")
    logger.info("Initializing Google Gemini API Client...")
    client = genai.Client(api_key=gemini_key)

    logger.info(f"Uploading audio file '{file_path.name}' to Gemini File API...")
    uploaded_file = client.files.upload(file=file_path)

    prompt = (
        "You are an expert executive meeting assistant.\n"
        "1. Transcribe the meeting audio completely and accurately.\n"
        "2. Summarize the transcript into key decisions and action items.\n"
        "Return ONLY a JSON object matching this exact schema:\n"
        "{\n"
        '  "transcript": "Full verbatim transcript text of the audio",\n'
        '  "overview": "Concise 2-3 sentence executive summary",\n'
        '  "key_decisions": ["Decision 1", "Decision 2"],\n'
        '  "key_topics": ["Topic 1", "Topic 2"],\n'
        '  "action_items": [\n'
        '    {"task": "Description of action", "assignee": "Person responsible or Unassigned", "priority": "High|Medium|Low"}\n'
        '  ]\n'
        "}"
    )

    logger.info("Generating transcription & summary with Gemini 1.5 Flash...")
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[uploaded_file, prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2
            )
        )
        parsed = json.loads(response.text)
        return parsed
    except Exception as e:
        logger.error(f"Gemini API Processing error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Google Gemini API error: {str(e)}"
        )
    finally:
        # Cleanup uploaded file on Gemini server
        try:
            client.files.delete(name=uploaded_file.name)
            logger.info("Deleted file from Gemini File API temporary storage.")
        except Exception:
            pass

async def process_with_openai(file_path: Path) -> Dict[str, Any]:
    """
    Processes audio using OpenAI Whisper ASR + GPT-4o-mini.
    """
    if not HAS_OPENAI_SDK:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="openai SDK is not installed. Please run: pip install openai"
        )
    
    api_key = os.getenv("OPENAI_API_KEY")
    client = OpenAI(api_key=api_key)

    logger.info("Transcribing audio with OpenAI Whisper API...")
    with open(file_path, "rb") as f:
        transcription_resp = client.audio.transcriptions.create(
            model="whisper-1",
            file=f,
            response_format="text"
        )
    transcript_text = str(transcription_resp).strip()

    system_prompt = (
        "You are an executive meeting assistant. "
        "Summarize the transcript and return ONLY valid JSON matching this schema:\n"
        '{"overview": "...", "key_decisions": ["..."], "key_topics": ["..."], '
        '"action_items": [{"task": "...", "assignee": "...", "priority": "High|Medium|Low"}]}'
    )

    logger.info("Generating summary with GPT-4o-mini...")
    llm_resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Transcript:\n{transcript_text}"}
        ],
        response_format={"type": "json_object"},
        temperature=0.3
    )
    parsed_summary = json.loads(llm_resp.choices[0].message.content)
    parsed_summary["transcript"] = transcript_text
    return parsed_summary

def process_with_demo(filename: str) -> Dict[str, Any]:
    """
    Fallback Demo Mode when no API keys are configured.
    Returns simulated transcript and summary so UI works seamlessly out-of-the-box.
    """
    logger.info("Running in DEMO MODE (No API key set in .env).")
    return {
        "transcript": (
            f"[DEMO TRANSCRIPT for '{filename}']\n"
            "Alex: Good morning team, let's review our Q3 product roadmap and architecture update.\n"
            "Sarah: Thanks Alex. We've finalized the API migration to FastAPI. Latency dropped by 45%.\n"
            "Michael: Excellent. On the storage side, we decided to adopt native JSON schema file logging for lightweight compliance.\n"
            "Alex: Great. Sarah, please complete the final documentation push by Friday. Michael, handle the security review."
        ),
        "overview": (
            f"Demo summary generated for '{filename}'. The team reviewed Q3 product goals, "
            "confirmed FastAPI architecture improvements, and finalized key deployment tasks."
        ),
        "key_decisions": [
            "Approved FastAPI backend architecture for production deployment.",
            "Adopted lightweight native JSON storage module without external DB dependencies."
        ],
        "key_topics": [
            "Q3 Product Roadmap",
            "API Latency Optimization",
            "Security & Compliance Checklist"
        ],
        "action_items": [
            {"task": "Push completed API documentation to repository", "assignee": "Sarah", "priority": "High"},
            {"task": "Conduct backend security audit and review", "assignee": "Michael", "priority": "Medium"},
            {"task": "Prepare release notes for Q3 milestone", "assignee": "Alex", "priority": "Low"}
        ]
    }

@app.post("/api/summarize")
async def summarize_meeting(file: UploadFile = File(...)):
    """
    Main pipeline endpoint supporting Gemini (Free), OpenAI, or Demo mode.
    """
    file_ext = validate_audio_file(file)
    summary_id = f"summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
    temp_file_path = TEMP_AUDIO_DIR / f"{summary_id}{file_ext}"

    logger.info(f"Processing upload '{file.filename}' (ID: {summary_id})")

    try:
        # Step 1: Save audio to temporary path with streaming size validation
        size_accumulated = 0
        with open(temp_file_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                size_accumulated += len(chunk)
                if size_accumulated > MAX_FILE_SIZE_BYTES:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE_MB}MB."
                    )
                buffer.write(chunk)

        # Step 2: Determine Provider
        provider = get_active_provider()
        logger.info(f"Active Processing Engine: '{provider.upper()}'")

        if provider == "gemini":
            result_raw = await process_with_gemini(temp_file_path)
        elif provider == "openai":
            result_raw = await process_with_openai(temp_file_path)
        else:
            result_raw = process_with_demo(file.filename)

        # Step 3: Standardize Payload
        result_payload = {
            "id": summary_id,
            "filename": file.filename,
            "created_at": datetime.utcnow().isoformat() + "Z",
            "file_size_bytes": size_accumulated,
            "provider_used": provider,
            "transcript": result_raw.get("transcript", "No transcript text generated."),
            "summary": {
                "overview": result_raw.get("overview", "No overview generated."),
                "key_decisions": result_raw.get("key_decisions", []),
                "key_topics": result_raw.get("key_topics", [])
            },
            "action_items": result_raw.get("action_items", [])
        }

        # Step 4: Save to Native JSON Storage
        target_json_path = DATA_DIR / f"{summary_id}.json"
        with open(target_json_path, "w", encoding="utf-8") as f:
            json.dump(result_payload, f, indent=2, ensure_ascii=False)

        logger.info(f"Successfully saved summary to {target_json_path}")
        return JSONResponse(status_code=status.HTTP_200_OK, content=result_payload)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error processing audio summarization.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal processing error: {str(e)}"
        )
    finally:
        # Step 5: Guaranteed cleanup of temporary audio file
        if temp_file_path.exists():
            try:
                temp_file_path.unlink()
                logger.info(f"Cleaned up temp file: {temp_file_path}")
            except Exception:
                pass

@app.get("/api/history")
def get_summary_history():
    """
    Returns a list of all previously processed meeting summary metadata.
    """
    history = []
    try:
        json_files = list(DATA_DIR.glob("*.json"))
        for file_path in json_files:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    history.append({
                        "id": data.get("id"),
                        "filename": data.get("filename", "Unknown"),
                        "created_at": data.get("created_at"),
                        "file_size_bytes": data.get("file_size_bytes", 0),
                        "provider_used": data.get("provider_used", "N/A"),
                        "overview": data.get("summary", {}).get("overview", "")[:120] + "...",
                        "action_items_count": len(data.get("action_items", []))
                    })
            except Exception:
                continue
        
        history.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return {"history": history, "total": len(history)}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve history: {str(e)}"
        )

@app.get("/api/summary/{summary_id}")
def get_summary_by_id(summary_id: str):
    """
    Retrieves full details of a specific saved meeting summary by ID.
    """
    safe_id = Path(summary_id).name
    file_path = DATA_DIR / f"{safe_id}.json"
    
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Summary with ID '{summary_id}' not found."
        )
    
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load summary: {str(e)}"
        )

@app.delete("/api/summary/{summary_id}")
def delete_summary(summary_id: str):
    """
    Deletes a saved meeting summary JSON file.
    """
    safe_id = Path(summary_id).name
    file_path = DATA_DIR / f"{safe_id}.json"
    
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Summary with ID '{summary_id}' not found."
        )
    
    try:
        file_path.unlink()
        return {"status": "success", "message": f"Summary '{summary_id}' deleted."}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete summary: {str(e)}"
        )

# Serve Static Frontend Files
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
def serve_index():
    """
    Serves the main frontend single-page application index.html.
    """
    index_file = STATIC_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Frontend index.html file missing in static directory."
        )
    return FileResponse(index_file, headers={"Cache-Control": "no-cache, no-store, must-revalidate"})

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    logger.info(f"Starting Meeting Summarizer server at http://{host}:{port}")
    uvicorn.run("main:app", host=host, port=port, reload=True)
