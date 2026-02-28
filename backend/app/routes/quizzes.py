from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.dependencies import get_current_user, require_admin
from app.services import supabase_service as db

router = APIRouter()


# ─── Schemas ──────────────────────────────────────────────────────────────────

class QuizAnswerRequest(BaseModel):
    quiz_id: str
    question_id: str
    selected_option: str  # "a" | "b" | "c" | "d"


class TriggerQuizRequest(BaseModel):
    quiz_id: str
    class_id: str


class CreateQuizRequest(BaseModel):
    class_id: str
    title: str
    subject: Optional[str] = None
    time_limit_seconds: int = 60
    is_live: bool = False


class CreateQuestionRequest(BaseModel):
    quiz_id: str
    question_text: str
    option_a: str
    option_b: str
    option_c: Optional[str] = None
    option_d: Optional[str] = None
    correct_answer: str  # "a" | "b" | "c" | "d"
    points: int = 1
    order_index: int = 0


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _assert_enrolled(student_id: str, class_id: str):
    enrolled = await db.check_student_enrollment(student_id, class_id)
    if not enrolled:
        raise HTTPException(status_code=403, detail="Not enrolled in this class")


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/class/{class_id}")
async def list_class_quizzes(class_id: str, current_user=Depends(get_current_user)):
    if current_user["role"] == "student":
        await _assert_enrolled(current_user["id"], class_id)
    return await db.get_quizzes_for_class(class_id)


@router.get("/{quiz_id}")
async def get_quiz_detail(quiz_id: str, current_user=Depends(get_current_user)):
    quiz = await db.get_quiz(quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Strip correct answers from student view — they must be kept server-side
    if current_user["role"] == "student":
        for q in quiz.get("quiz_questions") or []:
            q.pop("correct_answer", None)

    return quiz


@router.post("/", status_code=201)
async def create_quiz(req: CreateQuizRequest, admin=Depends(require_admin)):
    return await db.create_quiz_record(
        {**req.model_dump(), "created_by": admin["id"], "is_active": False}
    )


@router.post("/questions", status_code=201)
async def add_question(req: CreateQuestionRequest, admin=Depends(require_admin)):
    return await db.add_quiz_question(req.model_dump())


@router.post("/trigger")
async def trigger_live_quiz(req: TriggerQuizRequest, admin=Depends(require_admin)):
    updated = await db.update_quiz_record(
        req.quiz_id,
        {"is_active": True, "triggered_at": datetime.utcnow().isoformat()},
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return {"message": "Quiz triggered", "quiz": updated}


@router.post("/{quiz_id}/close")
async def close_quiz(quiz_id: str, admin=Depends(require_admin)):
    await db.update_quiz_record(quiz_id, {"is_active": False})
    return {"message": "Quiz closed"}


@router.post("/{quiz_id}/answers")
async def submit_answer(
    quiz_id: str,
    req: QuizAnswerRequest,
    current_user=Depends(get_current_user),
):
    if req.selected_option not in ("a", "b", "c", "d"):
        raise HTTPException(status_code=422, detail="selected_option must be a, b, c, or d")

    quiz = await db.get_quiz(quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    if not quiz.get("is_active"):
        raise HTTPException(status_code=400, detail="Quiz is not currently active")

    already_answered = await db.check_quiz_answer_exists(current_user["id"], req.question_id)
    if already_answered:
        raise HTTPException(status_code=400, detail="Answer already submitted for this question")

    answer = await db.submit_quiz_answer(
        {
            "student_id": current_user["id"],
            "quiz_id": quiz_id,
            "question_id": req.question_id,
            "selected_option": req.selected_option,
            "submitted_at": datetime.utcnow().isoformat(),
        }
    )
    return {"message": "Answer submitted", "answer_id": answer["id"]}


@router.get("/{quiz_id}/my-results")
async def get_my_results(quiz_id: str, current_user=Depends(get_current_user)):
    """Students can only see their own results."""
    quiz = await db.get_quiz(quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    answers = await db.get_student_quiz_answers(current_user["id"], quiz_id)
    questions = quiz.get("quiz_questions") or []
    correct_map = {q["id"]: q["correct_answer"] for q in questions}
    total = len(questions)
    score = sum(
        1 for a in answers if correct_map.get(a["question_id"]) == a["selected_option"]
    )

    return {
        "quiz_id": quiz_id,
        "score": score,
        "total": total,
        "percentage": round((score / total * 100) if total else 0, 2),
        "answers": answers,
    }


@router.get("/{quiz_id}/results")
async def get_all_results(quiz_id: str, admin=Depends(require_admin)):
    """Admin only: all students' results for a quiz."""
    return await db.get_quiz_results_admin(quiz_id)
