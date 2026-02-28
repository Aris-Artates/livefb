from fastapi import APIRouter, HTTPException, Depends
from app.dependencies import get_current_user
from app.services.ollama_service import generate_school_recommendations
from app.services import supabase_service as db

router = APIRouter()

@router.get("/recommendations/{student_id}")
async def get_recommendations(student_id: str, current_user=Depends(get_current_user)):
    if current_user["role"] == "student" and current_user["id"] != student_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Fetch quiz answers (using student_quiz_answers helper)
    answers = await db.get_student_quiz_answers(student_id, "") # empty quiz_id to get all
    if not answers:
        return {"student_id": student_id, "message": "No quiz data.", "recommendations": []}

    # Simplified scoring logic for the example
    quiz_results = []
    # (Scoring logic remains similar but uses db.get_quiz_questions_for_scoring)
    
    recommendations = await generate_school_recommendations(student_id, quiz_results)

    # Cache in Supabase using the new upsert helper
    await db.upsert_ai_recommendation({
        "student_id": student_id,
        "recommendations": recommendations,
        "generated_at": datetime.utcnow().isoformat(),
    })

    return recommendations