"""
Supabase database access via the REST API (PostgREST).

We call the Supabase REST API directly with httpx instead of using the
supabase-py client library.  The reason: supabase-py validates the API
key as a JWT in its constructor, but Supabase's newer  sb_secret_* /
sb_publishable_* keys are NOT JWTs — so supabase-py raises
SupabaseException("Invalid API key") before making any network call.

Direct httpx calls have no such restriction; we confirmed they work
with the sb_secret_* service-role key.
"""

import httpx
from fastapi import HTTPException
from app.config import settings
from typing import Optional, List, Dict, Any

# Build base URL and re-usable headers once at import time.
# These use settings, so they are evaluated lazily via _headers() to avoid
# import-time errors when settings are not yet loaded in tests.

def _base() -> str:
    return f"{settings.SUPABASE_URL}/rest/v1"

def _headers(prefer: str = "return=representation") -> dict:
    return {
        "apikey": settings.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": prefer,
    }


# ─── Low-level helpers ────────────────────────────────────────────────────────

def _raise(resp: httpx.Response) -> None:
    """Convert Supabase error responses into readable HTTPExceptions."""
    if resp.is_error:
        try:
            body = resp.json()
            detail = body.get("message") or body.get("details") or body.get("hint") or str(body)
        except Exception:
            detail = resp.text or f"HTTP {resp.status_code}"
        raise HTTPException(status_code=502, detail=f"Database error: {detail}")


def _get(table: str, params: dict) -> list:
    with httpx.Client(timeout=10) as client:
        resp = client.get(f"{_base()}/{table}", headers=_headers(), params=params)
        _raise(resp)
        return resp.json() or []


def _post(table: str, data: dict) -> dict:
    with httpx.Client(timeout=10) as client:
        resp = client.post(f"{_base()}/{table}", headers=_headers(), json=data)
        _raise(resp)
        result = resp.json()
        return result[0] if isinstance(result, list) else result


def _patch(table: str, params: dict, data: dict) -> dict:
    with httpx.Client(timeout=10) as client:
        resp = client.patch(
            f"{_base()}/{table}", headers=_headers(), params=params, json=data
        )
        _raise(resp)
        result = resp.json()
        return result[0] if isinstance(result, list) else result


def _one(table: str, params: dict) -> Optional[dict]:
    """Return the first matching row, or None."""
    rows = _get(table, {**params, "limit": "1"})
    return rows[0] if rows else None


# ─── Users ────────────────────────────────────────────────────────────────────

async def get_user_by_id(user_id: str) -> Optional[Dict]:
    return _one("users", {"id": f"eq.{user_id}"})


async def get_user_by_email(email: str) -> Optional[Dict]:
    return _one("users", {"email": f"eq.{email}"})


async def get_user_by_facebook_id(facebook_id: str) -> Optional[Dict]:
    return _one("users", {"facebook_id": f"eq.{facebook_id}"})


async def create_user(user_data: Dict) -> Dict:
    return _post("users", user_data)


async def update_user(user_id: str, updates: Dict) -> Dict:
    return _patch("users", {"id": f"eq.{user_id}"}, updates)


# ─── Livestreams ──────────────────────────────────────────────────────────────

async def get_livestream(livestream_id: str) -> Optional[Dict]:
    rows = _get(
        "livestreams",
        {"id": f"eq.{livestream_id}", "select": "*", "limit": "1"},
    )
    return rows[0] if rows else None


async def get_livestreams_for_student(student_id: str) -> List[Dict]:
    return _get("livestreams", {"select": "*", "order": "started_at.desc.nullslast"})


async def get_all_livestreams() -> List[Dict]:
    return _get("livestreams", {"select": "*", "order": "started_at.desc.nullslast"})


# ─── Comments ─────────────────────────────────────────────────────────────────

async def create_comment(comment_data: Dict) -> Dict:
    return _post("comments", comment_data)


async def get_comments_for_livestream(livestream_id: str) -> List[Dict]:
    return _get(
        "comments",
        {
            "livestream_id": f"eq.{livestream_id}",
            "is_deleted": "eq.false",
            "select": "*, users(full_name, avatar_url)",
            "order": "created_at.asc",
        },
    )


# ─── Quizzes ──────────────────────────────────────────────────────────────────

async def get_quiz(quiz_id: str) -> Optional[Dict]:
    rows = _get(
        "quizzes",
        {"id": f"eq.{quiz_id}", "select": "*, quiz_questions(*)", "limit": "1"},
    )
    return rows[0] if rows else None


async def get_quizzes_for_class(class_id: str) -> List[Dict]:
    return _get("quizzes", {"class_id": f"eq.{class_id}"})


async def submit_quiz_answer(answer_data: Dict) -> Dict:
    return _post("quiz_answers", answer_data)


async def get_student_quiz_answers(student_id: str, quiz_id: str) -> List[Dict]:
    return _get(
        "quiz_answers",
        {"student_id": f"eq.{student_id}", "quiz_id": f"eq.{quiz_id}"},
    )


async def get_quiz_results_admin(quiz_id: str) -> List[Dict]:
    return _get(
        "quiz_answers",
        {"quiz_id": f"eq.{quiz_id}", "select": "*, users(full_name, email)"},
    )


# ─── Q&A ──────────────────────────────────────────────────────────────────────

async def create_qna_session(session_data: Dict) -> Dict:
    return _post("qna_sessions", session_data)


async def get_active_qna_session(class_id: str) -> Optional[Dict]:
    rows = _get(
        "qna_sessions",
        {
            "class_id": f"eq.{class_id}",
            "is_active": "eq.true",
            "select": "*, qna_questions(*)",
            "limit": "1",
        },
    )
    return rows[0] if rows else None


async def get_qna_session(session_id: str) -> Optional[Dict]:
    """Fetch a single Q&A session by ID (regardless of active status)."""
    return _one("qna_sessions", {"id": f"eq.{session_id}", "select": "id,is_active"})


async def submit_qna_question(question_data: Dict) -> Dict:
    return _post("qna_questions", question_data)


# ─── Livestream Admin Actions ────────────────────────────────────────────────

async def create_livestream_record(data: Dict) -> Dict:
    return _post("livestreams", data)


async def update_livestream_record(livestream_id: str, updates: Dict) -> Optional[Dict]:
    rows = _patch(
        "livestreams",
        {"id": f"eq.{livestream_id}"},
        updates,
    )
    return rows

# ─── Additional CRUD Helpers ─────────────────────────────────────────────────

async def check_student_enrollment(student_id: str, class_id: str) -> bool:
    rows = _get("enrollments", {"student_id": f"eq.{student_id}", "class_id": f"eq.{class_id}", "select": "id"})
    return len(rows) > 0

async def update_qna_question(question_id: str, updates: Dict) -> Dict:
    return _patch("qna_questions", {"id": f"eq.{question_id}"}, updates)

async def update_qna_session(session_id: str, updates: Dict) -> Dict:
    return _patch("qna_sessions", {"id": f"eq.{session_id}"}, updates)

async def create_quiz_record(data: Dict) -> Dict:
    return _post("quizzes", data)

async def add_quiz_question(data: Dict) -> Dict:
    return _post("quiz_questions", data)

async def update_quiz_record(quiz_id: str, updates: Dict) -> Dict:
    return _patch("quizzes", {"id": f"eq.{quiz_id}"}, updates)

async def check_quiz_answer_exists(student_id: str, question_id: str) -> bool:
    rows = _get("quiz_answers", {"student_id": f"eq.{student_id}", "question_id": f"eq.{question_id}", "select": "id"})
    return len(rows) > 0

async def update_comment_record(comment_id: str, updates: Dict) -> Dict:
    return _patch("comments", {"id": f"eq.{comment_id}"}, updates)

async def get_quiz_questions_for_scoring(quiz_id: str) -> List[Dict]:
    return _get("quiz_questions", {"quiz_id": f"eq.{quiz_id}", "select": "id, correct_answer"})

async def upsert_ai_recommendation(data: Dict) -> Dict:
    # PostgREST upsert is done via POST with a specific header
    with httpx.Client(timeout=10) as client:
        headers = _headers()
        headers["Prefer"] = "resolution=merge-duplicates"
        resp = client.post(f"{_base()}/ai_recommendations", headers=headers, json=data)
        resp.raise_for_status()
        return resp.json()


# ─── Classes ──────────────────────────────────────────────────────────────────

async def get_all_classes() -> List[Dict]:
    return _get("classes", {"is_active": "eq.true", "order": "title.asc"})


async def get_livestream_by_facebook_video_id(fb_video_id: str) -> Optional[Dict]:
    return _one("livestreams", {"facebook_video_id": f"eq.{fb_video_id}"})


async def deactivate_livestream_by_video_id(fb_video_id: str) -> None:
    """Mark a livestream as inactive when the Facebook Live ends."""
    with httpx.Client(timeout=10) as client:
        resp = client.patch(
            f"{_base()}/livestreams",
            headers=_headers(prefer="return=minimal"),
            params={"facebook_video_id": f"eq.{fb_video_id}"},
            json={"is_active": False},
        )
        # 404 (no rows) is fine — record may have been deleted manually
        if resp.is_error and resp.status_code != 404:
            _raise(resp)


def get_supabase_client():
    """
    TEMPORARY STUB: 
    This allows the app to boot while we refactor the routes.
    The app will only crash if an old route is actually triggered.
    """
    raise RuntimeError(
        "Legacy get_supabase_client was called! "
        "This route needs to be refactored to use the new service functions."
    )