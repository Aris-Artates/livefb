from supabase import create_client, Client
from app.config import settings
from typing import Optional, List, Dict, Any

# Use service_role key — bypass RLS for trusted backend operations
_client: Optional[Client] = None


def get_supabase_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    return _client


# ─── Users ────────────────────────────────────────────────────────────────────

async def get_user_by_id(user_id: str) -> Optional[Dict]:
    sb = get_supabase_client()
    result = sb.table("users").select("*").eq("id", user_id).maybe_single().execute()
    return result.data


async def get_user_by_email(email: str) -> Optional[Dict]:
    sb = get_supabase_client()
    result = sb.table("users").select("*").eq("email", email).maybe_single().execute()
    return result.data


async def get_user_by_facebook_id(facebook_id: str) -> Optional[Dict]:
    sb = get_supabase_client()
    result = (
        sb.table("users").select("*").eq("facebook_id", facebook_id).maybe_single().execute()
    )
    return result.data


async def create_user(user_data: Dict) -> Dict:
    sb = get_supabase_client()
    result = sb.table("users").insert(user_data).execute()
    return result.data[0]


async def update_user(user_id: str, updates: Dict) -> Dict:
    sb = get_supabase_client()
    result = sb.table("users").update(updates).eq("id", user_id).execute()
    return result.data[0]


# ─── Livestreams ──────────────────────────────────────────────────────────────

async def get_livestream(livestream_id: str) -> Optional[Dict]:
    sb = get_supabase_client()
    result = (
        sb.table("livestreams")
        .select("*, classes(*)")
        .eq("id", livestream_id)
        .maybe_single()
        .execute()
    )
    return result.data


async def get_livestreams_for_student(student_id: str) -> List[Dict]:
    sb = get_supabase_client()
    # Fetch livestreams for classes the student is enrolled in
    result = (
        sb.table("livestreams")
        .select("*, classes!inner(*), classes!inner(enrollments!inner(student_id))")
        .eq("classes.enrollments.student_id", student_id)
        .execute()
    )
    return result.data or []


async def get_all_livestreams() -> List[Dict]:
    sb = get_supabase_client()
    result = sb.table("livestreams").select("*, classes(*)").execute()
    return result.data or []


# ─── Comments ─────────────────────────────────────────────────────────────────

async def create_comment(comment_data: Dict) -> Dict:
    sb = get_supabase_client()
    result = sb.table("comments").insert(comment_data).execute()
    return result.data[0]


async def get_comments_for_livestream(livestream_id: str) -> List[Dict]:
    sb = get_supabase_client()
    result = (
        sb.table("comments")
        .select("*, users(full_name, avatar_url)")
        .eq("livestream_id", livestream_id)
        .eq("is_deleted", False)
        .order("created_at")
        .execute()
    )
    return result.data or []


# ─── Quizzes ──────────────────────────────────────────────────────────────────

async def get_quiz(quiz_id: str) -> Optional[Dict]:
    sb = get_supabase_client()
    result = (
        sb.table("quizzes")
        .select("*, quiz_questions(*)")
        .eq("id", quiz_id)
        .maybe_single()
        .execute()
    )
    return result.data


async def get_quizzes_for_class(class_id: str) -> List[Dict]:
    sb = get_supabase_client()
    result = sb.table("quizzes").select("*").eq("class_id", class_id).execute()
    return result.data or []


async def submit_quiz_answer(answer_data: Dict) -> Dict:
    sb = get_supabase_client()
    result = sb.table("quiz_answers").insert(answer_data).execute()
    return result.data[0]


async def get_student_quiz_answers(student_id: str, quiz_id: str) -> List[Dict]:
    sb = get_supabase_client()
    result = (
        sb.table("quiz_answers")
        .select("*")
        .eq("student_id", student_id)
        .eq("quiz_id", quiz_id)
        .execute()
    )
    return result.data or []


async def get_quiz_results_admin(quiz_id: str) -> List[Dict]:
    sb = get_supabase_client()
    result = (
        sb.table("quiz_answers")
        .select("*, users(full_name, email)")
        .eq("quiz_id", quiz_id)
        .execute()
    )
    return result.data or []


# ─── Q&A ──────────────────────────────────────────────────────────────────────

async def create_qna_session(session_data: Dict) -> Dict:
    sb = get_supabase_client()
    result = sb.table("qna_sessions").insert(session_data).execute()
    return result.data[0]


async def get_active_qna_session(class_id: str) -> Optional[Dict]:
    sb = get_supabase_client()
    result = (
        sb.table("qna_sessions")
        .select("*, qna_questions(*)")
        .eq("class_id", class_id)
        .eq("is_active", True)
        .maybe_single()
        .execute()
    )
    return result.data


async def submit_qna_question(question_data: Dict) -> Dict:
    sb = get_supabase_client()
    result = sb.table("qna_questions").insert(question_data).execute()
    return result.data[0]
