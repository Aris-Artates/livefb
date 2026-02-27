import httpx
import json
from typing import Dict, List
from app.config import settings

_RECOMMENDATION_PROMPT = """\
You are an educational advisor AI. Based on the student quiz performance below, recommend 2-3 schools or programs they are likely to excel in.

Student Performance:
{performance_summary}

Rules:
- Provide 2-3 recommendations with brief reasoning (1-2 sentences each).
- Express likelihood as a percentage RANGE (e.g. "65-75%"). NEVER use 100%.
- Be encouraging but realistic.
- Keep total response under 200 words.

Respond ONLY with valid JSON in this exact shape:
{{
  "recommendations": [
    {{
      "school_name": "...",
      "program": "...",
      "likelihood_range": "XX-XX%",
      "reasoning": "..."
    }}
  ],
  "general_advice": "..."
}}"""


async def generate_school_recommendations(
    student_id: str,
    quiz_results: List[Dict],
) -> Dict:
    """Call local Ollama model to generate personalised school recommendations."""

    # Aggregate scores per subject
    subject_scores: Dict[str, List[float]] = {}
    for r in quiz_results:
        subject = r.get("subject", "General")
        subject_scores.setdefault(subject, []).append(r.get("score_percentage", 0))

    if subject_scores:
        lines = [
            f"- {subj}: avg {sum(scores)/len(scores):.1f}% ({len(scores)} quiz{'zes' if len(scores)>1 else ''})"
            for subj, scores in subject_scores.items()
        ]
        summary = "\n".join(lines)
    else:
        summary = "No quiz data available yet."

    prompt = _RECOMMENDATION_PROMPT.format(performance_summary=summary)

    async with httpx.AsyncClient(timeout=90.0) as client:
        response = await client.post(
            f"{settings.OLLAMA_BASE_URL}/api/generate",
            json={
                "model": settings.OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "format": "json",
            },
        )
        response.raise_for_status()
        raw = response.json().get("response", "{}")

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parsed = {
            "recommendations": [],
            "general_advice": raw or "Unable to generate recommendations at this time.",
        }

    return {
        "student_id": student_id,
        "recommendations": parsed,
        "based_on_quizzes": len(quiz_results),
    }
