# Ollama Local AI Setup

Ollama runs a local LLM server. The FastAPI backend calls it to generate
school recommendations from students' quiz results.

## 1. Install Ollama

**macOS / Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows:**
Download the installer from https://ollama.com/download/windows

## 2. Pull the model

```bash
# Recommended: llama3.2 (small, fast, good reasoning)
ollama pull llama3.2

# Alternatives (heavier, potentially higher quality):
ollama pull mistral
ollama pull phi3
```

## 3. Start the Ollama server

```bash
ollama serve
# Runs on http://localhost:11434 by default
```

Verify it's working:
```bash
curl http://localhost:11434/api/tags
```

## 4. Configure the backend

In `backend/.env`:
```
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

## 5. Test the recommendation endpoint

After running the FastAPI server, hit:
```
GET /api/ai/recommendations/{student_id}
Authorization: Bearer <jwt_token>
```

The backend will:
1. Fetch the student's quiz answers from Supabase
2. Calculate per-subject score percentages
3. Send a structured prompt to Ollama
4. Parse and cache the JSON response in `ai_recommendations` table
5. Return recommendations with likelihood ranges (never 100%)

## Prompt design notes

The prompt enforces:
- 2–3 recommendations only
- Likelihood expressed as a range (e.g. "65-75%"), **never 100%**
- Brief reasoning per recommendation
- A general advice paragraph
- JSON-only output (uses `"format": "json"` in the Ollama API call)

## Running Ollama in production

For a server deployment, Ollama can be exposed on a private network:
```bash
OLLAMA_HOST=0.0.0.0:11434 ollama serve
```

Then set `OLLAMA_BASE_URL=http://YOUR_SERVER_IP:11434` in the backend `.env`.
Keep this endpoint private — do not expose it to the internet without auth.
