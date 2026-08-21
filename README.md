# MeetingSummarizer AI 🎙️✨

An automated, full-stack Meeting Summarizer application that converts meeting audio recordings (`.mp3`, `.wav`, `.m4a`, `.webm`, `.ogg`) into clean text transcripts, executive summaries, and action-oriented tasks.

Supports **100% FREE** API keys via **Google Gemini API**, as well as OpenAI and an out-of-the-box **Demo Mode** fallback.

---

## 🌟 Key Features

* **100% Free AI Engine Support:** Use a free **Google Gemini API** key (from [Google AI Studio](https://aistudio.google.com/)) for transcription & summarization with zero cost.
* **Instant Demo Mode:** If no API key is set, the application runs seamlessly in **Demo Mode**, letting you test the entire UI and features out-of-the-box.
* **Action-Oriented Task Extraction:** Automatically extracts key decisions, main topics, and prioritized tasks (`High`, `Medium`, `Low`) with assignees.
* **Native JSON Storage:** Transcripts and summaries stored in `data/summaries/` using standard Python `json` and `pathlib` modules.
* **Safe Audio Processing:** Dynamic temporary file storage with automatic cleanup in `finally:` blocks.
* **Modern Dashboard UI:** Dark glassmorphism layout, drag-and-drop file upload, audio player preview, transcript search/copy, interactive task checklist, and past meeting history drawer.

---

## 📁 Project Directory Structure

```
meeting-summarizer/
├── static/
│   ├── index.html        # Semantic HTML5 Single Page Dashboard
│   ├── style.css         # Modern CSS3 dark mode glassmorphism styles
│   └── script.js         # Vanilla JS async fetch() logic & DOM renderer
├── data/
│   └── summaries/        # Native JSON files (created dynamically at runtime)
├── temp_audio/           # Temporary audio files (auto-cleaned after processing)
├── .env.example          # Environment variables template
├── .gitignore            # Strict gitignore blocking venv, .env, temp files
├── main.py               # FastAPI backend & multi-provider AI pipeline
├── README.md             # Project documentation & setup instructions
└── requirements.txt      # Strictly minimal Python dependencies
```

---

## 🚀 Quickstart & Setup Guide

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Environment Setup (Free Gemini API Key)

Copy `.env.example` to create `.env`:

```bash
# Windows (PowerShell / CMD):
copy .env.example .env
# macOS / Linux:
cp .env.example .env
```

Open `.env` and set your **FREE Google Gemini API Key**:
> 🔑 Get a free key in 10 seconds at: **[https://aistudio.google.com/](https://aistudio.google.com/)**

```env
GEMINI_API_KEY=AIzaSy...your_actual_free_gemini_key
```

*(Note: If you don't add any key, the app will run in **Demo Mode** automatically!)*

---

## 💻 Running the Server Locally

Launch the server using Uvicorn (note: module name is `main:app` without `.py`):

```bash
uvicorn main:app --reload
```

Then open your browser at:
👉 **[http://127.0.0.1:8000](http://127.0.0.1:8000)**

---

## 🧪 API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Serves the single-page web app |
| `GET` | `/api/health` | Check active provider (`gemini`, `openai`, `demo`) |
| `POST` | `/api/summarize` | Upload audio, transcribe & generate summary |
| `GET` | `/api/history` | List all saved meeting summaries |
| `GET` | `/api/summary/{id}` | Retrieve specific summary JSON |
| `DELETE` | `/api/summary/{id}` | Delete a saved meeting summary |

---

## 📄 License
MIT License. Free for hackathon and open-source submission.
