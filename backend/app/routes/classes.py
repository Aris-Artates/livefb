from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.services import supabase_service as db

router = APIRouter()


@router.get("/")
async def list_classes(current_user=Depends(get_current_user)):
    return await db.get_all_classes()
