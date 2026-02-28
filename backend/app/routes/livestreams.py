from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.dependencies import get_current_user, require_admin
from app.services import supabase_service as db

router = APIRouter()


class CreateLivestreamRequest(BaseModel):
    class_id: str
    title: str
    facebook_video_id: Optional[str] = None
    facebook_group_id: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    is_private: bool = True


@router.get("/")
async def list_livestreams(current_user=Depends(get_current_user)):
    if current_user["role"] == "admin":
        return await db.get_all_livestreams()
    return await db.get_livestreams_for_student(current_user["id"])


@router.get("/{livestream_id}")
async def get_livestream_detail(
    livestream_id: str,
    current_user=Depends(get_current_user),
):
    stream = await db.get_livestream(livestream_id)
    if not stream:
        raise HTTPException(status_code=404, detail="Livestream not found")

    if current_user["role"] == "student":
        enrolled = await db.check_student_enrollment(
            current_user["id"], stream["class_id"]
        )
        if not enrolled:
            raise HTTPException(
                status_code=403, detail="You are not enrolled in this class"
            )

    return stream


@router.post("/", status_code=201)
async def create_livestream(
    req: CreateLivestreamRequest,
    admin=Depends(require_admin),
):
    return await db.create_livestream_record(
        {
            **req.model_dump(),
            "created_by": admin["id"],
            "is_active": False,
        }
    )


@router.patch("/{livestream_id}/activate")
async def activate_livestream(livestream_id: str, admin=Depends(require_admin)):
    updated = await db.update_livestream_record(
        livestream_id,
        {
            "is_active": True,
            "started_at": datetime.utcnow().isoformat(),
        },
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Livestream not found")
    return updated


@router.patch("/{livestream_id}/deactivate")
async def deactivate_livestream(livestream_id: str, admin=Depends(require_admin)):
    updated = await db.update_livestream_record(
        livestream_id,
        {
            "is_active": False,
            "ended_at": datetime.utcnow().isoformat(),
        },
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Livestream not found")
    return updated