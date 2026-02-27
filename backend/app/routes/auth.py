import uuid
import httpx
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr
from app.services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
)
from app.services.supabase_service import (
    get_user_by_email,
    get_user_by_facebook_id,
    create_user,
    update_user,
)
from app.dependencies import get_current_user

router = APIRouter()


# ─── Request / Response schemas ───────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class FacebookBindRequest(BaseModel):
    facebook_access_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _safe_user(user: dict) -> dict:
    """Strip sensitive fields before returning to client."""
    return {k: v for k, v in user.items() if k != "hashed_password"}


async def _verify_facebook_token(access_token: str) -> dict:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            "https://graph.facebook.com/me",
            params={"fields": "id,name,email,picture", "access_token": access_token},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Facebook access token")
    return resp.json()


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest):
    if await get_user_by_email(req.email):
        raise HTTPException(status_code=400, detail="Email already registered")

    user_data = {
        "id": str(uuid.uuid4()),
        "email": req.email,
        "hashed_password": hash_password(req.password),
        "full_name": req.full_name,
        "role": "student",  # All self-registrations are students; set admin manually
    }
    user = await create_user(user_data)
    return TokenResponse(
        access_token=create_access_token({"sub": user["id"], "role": user["role"]}),
        refresh_token=create_refresh_token({"sub": user["id"]}),
        user=_safe_user(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    user = await get_user_by_email(req.email)
    if not user or not user.get("hashed_password"):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(req.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return TokenResponse(
        access_token=create_access_token({"sub": user["id"], "role": user["role"]}),
        refresh_token=create_refresh_token({"sub": user["id"]}),
        user=_safe_user(user),
    )


@router.post("/facebook/callback", response_model=TokenResponse)
async def facebook_oauth_callback(facebook_access_token: str):
    """Exchange a Facebook user access token for an app JWT."""
    fb_user = await _verify_facebook_token(facebook_access_token)
    fb_id = fb_user["id"]
    fb_email = fb_user.get("email")

    # 1. Try find by Facebook ID
    user = await get_user_by_facebook_id(fb_id)

    # 2. Try find by email and bind Facebook ID
    if not user and fb_email:
        existing = await get_user_by_email(fb_email)
        if existing:
            user = await update_user(existing["id"], {"facebook_id": fb_id})

    # 3. Create new account
    if not user:
        avatar = (
            fb_user.get("picture", {}).get("data", {}).get("url")
            if isinstance(fb_user.get("picture"), dict)
            else None
        )
        user = await create_user(
            {
                "id": str(uuid.uuid4()),
                "email": fb_email or f"fb_{fb_id}@placeholder.local",
                "full_name": fb_user.get("name", "Facebook User"),
                "facebook_id": fb_id,
                "role": "student",
                "avatar_url": avatar,
            }
        )

    return TokenResponse(
        access_token=create_access_token({"sub": user["id"], "role": user["role"]}),
        refresh_token=create_refresh_token({"sub": user["id"]}),
        user=_safe_user(user),
    )


@router.post("/bind-facebook")
async def bind_facebook(
    req: FacebookBindRequest,
    current_user=Depends(get_current_user),
):
    """Bind an existing LMS account to a Facebook account."""
    fb_user = await _verify_facebook_token(req.facebook_access_token)
    fb_id = fb_user["id"]

    # Check if already bound to another account
    existing = await get_user_by_facebook_id(fb_id)
    if existing and existing["id"] != current_user["id"]:
        raise HTTPException(
            status_code=400, detail="This Facebook account is already bound to another user"
        )

    updated = await update_user(current_user["id"], {"facebook_id": fb_id})
    return {"message": "Facebook account bound successfully", "facebook_id": fb_id}


@router.get("/me")
async def get_me(current_user=Depends(get_current_user)):
    return _safe_user(current_user)
