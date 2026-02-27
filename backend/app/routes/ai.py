from fastapi import APIRouter, HTTPException, Depends
from app.dependencies import get_current_user
from app.services.ollama_service import generate_school_recommendations
from app.services.supabase_service import get_supabase_client

router = APIRouter()


@router.get("/recommendations/{student_id}")
async def get_recommendations(
    student_id: str,
    current_user=Depends(get_current_user),
):
    """
    Generate AI-powered school recommendations based on quiz performance.
    Students can only fetch their own recommendations.
    Admins can fetch any student's recommendations.
    """
    if current_user["role"] == "student" and current_user["id"] != student_id:
        raise HTTPException(status_code=403, detail="Access denied")

    sb = get_supabase_client()

    # Fetch all quiz answers with quiz metadata
    answers_result = (
        sb.table("quiz_answers")
        .select("quiz_id, selected_option, quizzes(subject, class_id)")
        .eq("student_id", student_id)
        .execute()
    )
    if not answers_result.data:
        return {
            "student_id": student_id,
            "message": "Complete some quizzes first to get personalised recommendations.",
            "recommendations": [],
        }

    # Compute per-quiz score percentages
    sb2 = get_supabase_client()
    quiz_scores: dict = {}
    for answer in answers_result.data:
        qid = answer["quiz_id"]
        quiz_scores.setdefault(
            qid,
            {
                "subject": (answer.get("quizzes") or {}).get("subject", "General"),
                "correct": 0,
                "total": 0,
            },
        )
        quiz_scores[qid]["total"] += 1

    # Fetch correct answers to calculate scores
    for qid, data in quiz_scores.items():
        correct_result = (
            sb2.table("quiz_questions")
            .select("id, correct_answer")
            .eq("quiz_id", qid)
            .execute()
        )
        student_answers = {
            a["question_id"]: a["selected_option"]
            for a in answers_result.data
            if a["quiz_id"] == qid
        }
        for q in correct_result.data or []:
            if student_answers.get(q["id"]) == q["correct_answer"]:
                data["correct"] += 1

    quiz_results = [
        {
            "subject": v["subject"],
            "score_percentage": round(
                (v["correct"] / v["total"] * 100) if v["total"] else 0, 2
            ),
        }
        for v in quiz_scores.values()
    ]

    recommendations = await generate_school_recommendations(student_id, quiz_results)

    # Cache in Supabase
    sb.table("ai_recommendations").upsert(
        {
            "student_id": student_id,
            "recommendations": recommendations,
            "generated_at": "now()",
        }
    ).execute()

    return recommendations
