from fastapi import APIRouter, HTTPException, Depends
from app.dependencies import get_current_user
from app.services.ollama_service import generate_school_recommendations
from app.services import supabase_service as db
from datetime import datetime

router = APIRouter()

@router.get("/recommendations/{student_id}")
async def get_recommendations(
    student_id: str,
    current_user=Depends(get_current_user),
):
    if current_user["role"] == "student" and current_user["id"] != student_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # 1. Fetch quiz answers using the new REST service
    # We pass an empty string for quiz_id to get ALL answers for this student
    answers = await db.get_student_quiz_answers(student_id, "")
    
    if not answers:
        return {
            "student_id": student_id,
            "message": "Complete some quizzes first to get personalized recommendations.",
            "recommendations": [],
        }

    # 2. Logic to calculate scores (Keeping it simple for now)
    quiz_results = []
    # (Your existing logic to aggregate scores goes here, 
    # but ensure it uses the 'answers' list we just fetched)

    # 3. Generate recommendations via Ollama (fail gracefully if Ollama is offline)
    try:
        recommendations = await generate_school_recommendations(student_id, quiz_results)
    except Exception:
        return {
            "student_id": student_id,
            "message": "AI recommendations are unavailable right now.",
            "recommendations": [],
            "based_on_quizzes": 0,
        }

    # 4. Cache in Supabase (non-fatal if it fails)
    try:
        await db.upsert_ai_recommendation({
            "student_id": student_id,
            "recommendations": recommendations,
            "generated_at": datetime.utcnow().isoformat(),
        })
    except Exception:
        pass

    return recommendations