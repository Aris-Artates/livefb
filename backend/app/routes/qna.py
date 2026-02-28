from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, constr
from datetime import datetime
from app.dependencies import get_current_user, require_admin
from app.services import supabase_service as db

router = APIRouter()


class CreateSessionRequest(BaseModel):
    class_id: str
    title: str


class SubmitQuestionRequest(BaseModel):
    session_id: str
    question_text: constr(min_length=3, max_length=500)  # type: ignore
    is_anonymous: bool = False


class AnswerQuestionRequest(BaseModel):
    answer_text: str


@router.post("/sessions", status_code=201)
async def create_session(req: CreateSessionRequest, admin=Depends(require_admin)):
    return await db.create_qna_session(
        {
            "class_id": req.class_id,
            "title": req.title,
            "created_by": admin["id"],
            "is_active": True,
            "created_at": datetime.utcnow().isoformat(),
        }
    )


@router.get("/sessions/active/{class_id}")
async def get_active_session(class_id: str, current_user=Depends(get_current_user)):
    session = await db.get_active_qna_session(class_id)
    if not session:
        return {"active": False, "session": None}

    # For student view: mask other students' identities on anonymous questions
    if current_user["role"] == "student":
        for q in session.get("qna_questions") or []:
            if q.get("is_anonymous") and q.get("student_id") != current_user["id"]:
                q["student_id"] = None
                q["users"] = {"full_name": "Anonymous"}

    return {"active": True, "session": session}


@router.post("/questions", status_code=201)
async def submit_question(
    req: SubmitQuestionRequest,
    current_user=Depends(get_current_user),
):
    session = await db.get_qna_session(req.session_id)
    if not session or not session.get("is_active"):
        raise HTTPException(status_code=404, detail="No active Q&A session found")

    return await db.submit_qna_question(
        {
            "session_id": req.session_id,
            "student_id": current_user["id"],
            "question_text": req.question_text,
            "is_anonymous": req.is_anonymous,
            "is_answered": False,
            "submitted_at": datetime.utcnow().isoformat(),
        }
    )


@router.patch("/questions/{question_id}/answer")
async def answer_question(
    question_id: str,
    req: AnswerQuestionRequest,
    admin=Depends(require_admin),
):
    updated = await db.update_qna_question(
        question_id,
        {
            "is_answered": True,
            "answer_text": req.answer_text,
            "answered_at": datetime.utcnow().isoformat(),
        },
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Question not found")
    return updated


@router.patch("/sessions/{session_id}/close")
async def close_session(session_id: str, admin=Depends(require_admin)):
    await db.update_qna_session(
        session_id,
        {"is_active": False, "ended_at": datetime.utcnow().isoformat()},
    )
    return {"message": "Q&A session closed"}
