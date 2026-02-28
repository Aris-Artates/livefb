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
| Auth | JWT (HS256) + Facebook OAuth |
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

---

### 2. Facebook App setup — TWO separate apps required

This project requires **two distinct Facebook apps** because Facebook enforces
different permission scopes and review processes for Login/OAuth versus video
embedding in private groups. Mixing them in a single app can cause permission
conflicts and complicate the App Review process.

| | App 1 — Login App | App 2 — Livestream App |
|---|---|---|
| **Purpose** | Facebook Login (OAuth), user auth | Embedding Facebook Live / group videos |
| **Products** | Facebook Login | Facebook Login (JS SDK requirement) |
| **Key permissions** | `public_profile`, `email` | `groups_access_member_info` |
| **Used by** | Backend (token verification) + Frontend (FB.login()) | Frontend only (XFBML fb-video embed) |
| **Env vars** | `FACEBOOK_LOGIN_APP_ID/SECRET` | `FACEBOOK_LIVESTREAM_APP_ID` |

---

#### App 1 — Facebook Login / OAuth App

This app handles the **"Continue with Facebook"** button and OAuth token
verification on the backend.

1. Go to https://developers.facebook.com → **My Apps** → **Create App**
2. Choose app type **"Consumer"** (or "None" if not listed)
3. Give it a name such as `MyLMS – Login`
4. From the left sidebar, click **Add Product** → **Facebook Login** → **Set Up**
5. In **Facebook Login → Settings**:
   - Under **Valid OAuth Redirect URIs**, add:
     ```
     https://your-domain.com/api/auth/facebook/callback
     http://localhost:8000/api/auth/facebook/callback   ← development
     ```
   - Save changes
6. Go to **App Settings → Basic**:
   - Copy **App ID** → this is `FACEBOOK_LOGIN_APP_ID`
   - Copy **App Secret** → this is `FACEBOOK_LOGIN_APP_SECRET`
7. Under **App Domains**, add your frontend domain (e.g. `yourdomain.com`)
8. Request the following permissions in **App Review** (required for production):
   - `email`
   - `public_profile` (approved by default)
9. Set the **App Mode** to **Live** when ready for production (development mode
   only allows app admins/testers to log in)

> **Security note:** The Login App Secret (`FACEBOOK_LOGIN_APP_SECRET`) must
> only ever live in the backend `.env` file. Never expose it to the frontend.

---

#### App 2 — Facebook Livestream / Video Embed App

This app handles embedding **Facebook Live videos and group videos** using the
Facebook JS SDK's XFBML `fb-video` tag.

1. Go to https://developers.facebook.com → **My Apps** → **Create App**
2. Choose app type **"Consumer"** (or "None")
3. Give it a name such as `MyLMS – Livestream`
4. From the left sidebar, click **Add Product** → **Facebook Login** → **Set Up**
   *(The JS SDK requires the Facebook Login product to be present, even for
   video embeds. You will not use FB.login() with this app.)*
5. Go to **App Settings → Basic**:
   - Under **App Domains**, add your frontend domain (e.g. `yourdomain.com`)
   - Also add `localhost` for development
   - Copy **App ID** → this is `FACEBOOK_LIVESTREAM_APP_ID`
   - The **App Secret is not needed** for this app — video embedding is
     entirely client-side and no server-side Graph API calls are made
6. To embed **private Facebook group videos**, you must request the
   `groups_access_member_info` permission via **App Review**:
   - Go to **App Review → Permissions and Features**
   - Request `groups_access_member_info`
   - Provide a screen recording / description showing how the permission is
     used (group members viewing a class livestream embedded in the LMS)
   - This review process can take several days to weeks
7. Under **Settings → Advanced**, add the frontend URL to
   **Allowed Domains for the JavaScript SDK**:
   ```
   https://yourdomain.com
   http://localhost:3000   ← development
   ```
8. Set the **App Mode** to **Live** when ready for production

> **Important:** Students must be **logged into Facebook** in their browser
> **and** be **members of the Facebook group** for private group video embeds
> to display. The LMS itself cannot bypass Facebook's group privacy — it only
> controls whether enrolled students can reach the livestream page.

---

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
# Edit .env with your keys (see table below)

# Run
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs (development only)

**Backend `.env` key reference:**

| Variable | Where to get it |
|---|---|
| `FACEBOOK_LOGIN_APP_ID` | App 1 → App Settings → Basic → App ID |
| `FACEBOOK_LOGIN_APP_SECRET` | App 1 → App Settings → Basic → App Secret |
| `FACEBOOK_LOGIN_REDIRECT_URI` | Must match what you added in App 1 → Facebook Login → Settings |
| `FACEBOOK_LIVESTREAM_APP_ID` | App 2 → App Settings → Basic → App ID |

---

### 4. Frontend

```bash
cd frontend
npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local with your keys (see table below)

# Run
npm run dev
```

Open http://localhost:3000

**Frontend `.env.local` key reference:**

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_FACEBOOK_LOGIN_APP_ID` | App 1 → App Settings → Basic → App ID |
| `NEXT_PUBLIC_FACEBOOK_LIVESTREAM_APP_ID` | App 2 → App Settings → Basic → App ID |

> The frontend only needs **App IDs** (not App Secrets). App Secrets must never
> be exposed in `NEXT_PUBLIC_*` variables as they are bundled into the client.

---

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
| Two FB apps | Login App Secret never reaches frontend; Livestream App has no secret |

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
NEXT_PUBLIC_API_URL                   = https://your-api-domain.com
NEXT_PUBLIC_FACEBOOK_LOGIN_APP_ID     = <App 1 ID>
NEXT_PUBLIC_FACEBOOK_LIVESTREAM_APP_ID = <App 2 ID>
NEXT_PUBLIC_SUPABASE_URL              = https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY         = eyJ...
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
3. The **Livestream App's** Facebook JS SDK renders the player — it respects the viewer's own Facebook session and group membership.
4. **Students must be logged into Facebook and be members of the group** to see private videos.

This means:
- No raw stream URL is exposed in the API (only IDs)
- Access is controlled both by your LMS (enrollment check) and by Facebook (group membership)
- For full private group API access, apply for the `groups_access_member_info` permission in the **Livestream App's** App Review process

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
