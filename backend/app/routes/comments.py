from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, constr
from datetime import datetime
from app.dependencies import get_current_user, require_admin
from app.services import supabase_service as db

router = APIRouter()


class CommentRequest(BaseModel):
    livestream_id: str
    content: constr(min_length=1, max_length=500)  # type: ignore


async def _get_stream_or_404(livestream_id: str):
    stream = await db.get_livestream(livestream_id)
    if not stream:
        raise HTTPException(status_code=404, detail="Livestream not found")
    return stream


async def _assert_enrolled(student_id: str, class_id: str):
    enrolled = await db.check_student_enrollment(student_id, class_id)
    if not enrolled:
        raise HTTPException(status_code=403, detail="Not enrolled in this class")


@router.get("/{livestream_id}")
async def get_comments(
    livestream_id: str,
    current_user=Depends(get_current_user),
):
    stream = await _get_stream_or_404(livestream_id)
    if current_user["role"] == "student":
        await _assert_enrolled(current_user["id"], stream["class_id"])
    return await db.get_comments_for_livestream(livestream_id)


@router.post("/", status_code=201)
async def post_comment(
    req: CommentRequest,
    current_user=Depends(get_current_user),
):
    stream = await _get_stream_or_404(req.livestream_id)
    if not stream.get("is_active"):
        raise HTTPException(status_code=400, detail="Livestream is not active")
    if current_user["role"] == "student":
        await _assert_enrolled(current_user["id"], stream["class_id"])

    return await db.create_comment(
        {
            "student_id": current_user["id"],
            "livestream_id": req.livestream_id,
            "content": req.content,
            "created_at": datetime.utcnow().isoformat(),
        }
    )


@router.delete("/{comment_id}")
async def soft_delete_comment(comment_id: str, admin=Depends(require_admin)):
    """Admin only: soft-delete a comment."""
    updated = await db.update_comment_record(comment_id, {"is_deleted": True})
    if not updated:
        raise HTTPException(status_code=404, detail="Comment not found")
    return {"message": "Comment removed"}
