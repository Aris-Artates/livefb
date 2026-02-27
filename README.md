# Secure LMS — Next.js + FastAPI + Supabase + Ollama

A production-ready Learning Management System with Facebook Live integration,
live quizzes, Q&A sessions, and AI-powered school recommendations.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (TypeScript, Tailwind CSS) |
| Backend | FastAPI (Python) |
| Database | Supabase (PostgreSQL + RLS) |
| AI | Ollama (local LLM) |
| Auth | JWT (RS256) + Facebook OAuth |
| Hosting | Vercel (frontend) + any VPS/cloud (backend) |

---

## Project Structure

```
lms-project/
├─ frontend/          # Next.js app
│  ├─ pages/
│  ├─ components/
│  ├─ utils/
│  └─ styles/
├─ backend/           # FastAPI app
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ config.py
│  │  ├─ dependencies.py
│  │  ├─ routes/      # auth, livestreams, comments, quizzes, qna, ai
│  │  └─ services/    # auth_service, supabase_service, ollama_service
│  └─ requirements.txt
├─ database/
│  ├─ schema.sql      # All table definitions
│  └─ rls_policies.sql
├─ ai/
│  └─ ollama_setup.md
└─ README.md
```

---

## Quick Start

### 1. Supabase setup

1. Create a project at https://supabase.com
2. Go to **SQL Editor** and run `database/schema.sql`
3. Run `database/rls_policies.sql`
4. Copy your **Project URL**, **anon key**, and **service_role key**

### 2. Facebook App setup

1. Go to https://developers.facebook.com → My Apps → Create App
2. Add **Facebook Login** product
3. Set valid OAuth redirect URIs (e.g. `https://yourdomain.com/login`)
4. For private group video embedding, request `groups_access_member_info` permission
5. Copy **App ID** and **App Secret**

### 3. Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your keys

# Run
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs (development only)

### 4. Frontend

```bash
cd frontend
npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local with your keys

# Run
npm run dev
```

Open http://localhost:3000

### 5. Ollama (AI recommendations)

See `ai/ollama_setup.md` for full instructions.

```bash
ollama pull llama3.2
ollama serve
```

---

## Security Architecture

### Authentication flow

```
Client → POST /api/auth/login → FastAPI validates credentials
       ← access_token (JWT, 1h) + refresh_token (JWT, 7d)

All subsequent requests:
Client → Authorization: Bearer <access_token> → FastAPI verifies JWT → Supabase query (service_role bypasses RLS)
```

### Key security measures

| Concern | Implementation |
|---------|---------------|
| JWT auth | `python-jose` + HS256; validated on every API request |
| Password hashing | `bcrypt` via `passlib` |
| Role enforcement | `require_admin` / `require_student` FastAPI dependencies |
| DB access control | Supabase RLS policies (students see only their own data) |
| Quiz answer privacy | RLS + API strips correct_answer from student responses |
| Anonymous Q&A | student_id masked in API response for anonymous questions |
| Secrets | `.env` files (never committed); Vercel environment variables in prod |
| HTTPS | Enforced via Vercel (frontend) + HSTS header; backend behind reverse proxy |
| CORS | Strict allow-list: only your frontend origin |
| CSP | Content-Security-Policy header in `next.config.js` |
| Facebook token | Verified server-side with `graph.facebook.com/me` before any user creation |

### Supabase RLS summary

- **users**: read own row only (admins read all)
- **enrollments**: students see their own; admins manage all
- **livestreams**: visible only to enrolled students
- **comments**: insert only to active livestreams of enrolled classes
- **quiz_answers**: `student_id = auth.uid()` — students CANNOT see others' answers
- **qna_questions**: all enrolled students see questions; anonymous ones are masked in API
- **ai_recommendations**: students see only their own

---

## Deployment

### Frontend → Vercel

```bash
# From the frontend/ directory
npx vercel

# Or connect your GitHub repo at vercel.com
```

Set environment variables in **Vercel Dashboard → Project → Settings → Environment Variables**:
```
NEXT_PUBLIC_API_URL          = https://your-api-domain.com
NEXT_PUBLIC_FACEBOOK_APP_ID  = your_fb_app_id
NEXT_PUBLIC_SUPABASE_URL     = https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...
```

Vercel automatically enforces HTTPS.

### Backend → VPS / Cloud Run / Railway

```bash
# Production run (behind nginx/caddy with TLS)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

Set `ENVIRONMENT=production` to disable `/docs` and `/redoc`.

Set all `.env` variables in your hosting provider's secret manager.

**Recommended nginx snippet (HTTPS + proxy):**
```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Facebook Live Embedding — Important Notes

Facebook's Graph API does **not** provide a dedicated "embed private group video" endpoint for third-party apps without explicit partner approval. The embed approach used here:

1. The backend stores the `facebook_video_id` and `facebook_group_id`.
2. The frontend renders an `fb-video` XFBML tag pointing to the group video URL.
3. The Facebook JS SDK renders the player — it respects the viewer's own Facebook session and group membership.
4. **Students must be logged into Facebook and be members of the group** to see private videos.

This means:
- No raw stream URL is exposed in the API (only IDs)
- Access is controlled both by your LMS (enrollment check) and by Facebook (group membership)
- For full private group API access, apply for the `groups_access_member_info` permission in the Facebook App Review process

---

## Adding Quizzes (Admin workflow)

1. `POST /api/quizzes/` — create a quiz for a class
2. `POST /api/quizzes/questions` — add questions with correct answers
3. During a class: `POST /api/quizzes/trigger` — activates the quiz
4. Students receive the quiz in the UI (poll or WebSocket in production)
5. `POST /api/quizzes/{id}/close` — closes submissions
6. `GET /api/quizzes/{id}/results` — admin sees all answers; students only see their own via `/my-results`

---

## License

MIT
