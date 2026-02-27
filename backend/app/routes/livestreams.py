from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.dependencies import get_current_user, require_admin
from app.services.supabase_service import (
    get_livestream,
    get_livestreams_for_student,
    get_all_livestreams,
    get_supabase_client,
)

router = APIRouter()


class CreateLivestreamRequest(BaseModel):
    class_id: str
    title: str
    facebook_video_id: Optional[str] = None
    facebook_group_id: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    is_private: bool = True


def _check_student_enrollment(student_id: str, class_id: str):
    sb = get_supabase_client()
    result = (
        sb.table("enrollments")
        .select("id")
        .eq("student_id", student_id)
        .eq("class_id", class_id)
        .execute()
    )
    return bool(result.data)


@router.get("/")
async def list_livestreams(current_user=Depends(get_current_user)):
    if current_user["role"] == "admin":
        return await get_all_livestreams()
    return await get_livestreams_for_student(current_user["id"])


@router.get("/{livestream_id}")
async def get_livestream_detail(
    livestream_id: str,
    current_user=Depends(get_current_user),
):
    stream = await get_livestream(livestream_id)
    if not stream:
        raise HTTPException(status_code=404, detail="Livestream not found")

    if current_user["role"] == "student":
        if not _check_student_enrollment(current_user["id"], stream["class_id"]):
            raise HTTPException(
                status_code=403, detail="You are not enrolled in this class"
            )
    return stream


@router.post("/", status_code=201)
async def create_livestream(
    req: CreateLivestreamRequest,
    admin=Depends(require_admin),
):
    sb = get_supabase_client()
    result = sb.table("livestreams").insert(
        {
            **req.model_dump(),
            "created_by": admin["id"],
            "is_active": False,
        }
    ).execute()
    return result.data[0]


@router.patch("/{livestream_id}/activate")
async def activate_livestream(livestream_id: str, admin=Depends(require_admin)):
    sb = get_supabase_client()
    result = (
        sb.table("livestreams")
        .update({"is_active": True, "started_at": datetime.utcnow().isoformat()})
        .eq("id", livestream_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Livestream not found")
    return result.data[0]


@router.patch("/{livestream_id}/deactivate")
async def deactivate_livestream(livestream_id: str, admin=Depends(require_admin)):
    sb = get_supabase_client()
    result = (
        sb.table("livestreams")
        .update({"is_active": False, "ended_at": datetime.utcnow().isoformat()})
        .eq("id", livestream_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Livestream not found")
    return result.data[0]
