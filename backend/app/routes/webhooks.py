"""
Facebook Webhook endpoint.

Setup steps (do once in the Facebook App Dashboard):
  1. Go to your Facebook App → Add Product → Webhooks
  2. Subscribe to the "group_feed" or "page" object → live_videos field
  3. Callback URL: https://<your-railway-domain>/api/webhooks/facebook
  4. Verify token: the value of FACEBOOK_WEBHOOK_VERIFY_TOKEN in your .env

When you go live in the configured Facebook Group, Facebook calls this endpoint,
the backend auto-creates and activates the livestream record so students see it
immediately on their dashboard — no manual steps needed.
"""

import logging
from fastapi import APIRouter, HTTPException, Query, Request
from app.config import settings
from app.services import supabase_service as db

router = APIRouter()
logger = logging.getLogger(__name__)


# ─── Webhook verification (Facebook calls this once during setup) ──────────────

@router.get("/facebook")
async def verify_webhook(
    hub_mode: str = Query(alias="hub.mode", default=""),
    hub_verify_token: str = Query(alias="hub.verify_token", default=""),
    hub_challenge: str = Query(alias="hub.challenge", default=""),
):
    """Facebook sends a GET to verify the webhook URL. Return the challenge."""
    if hub_mode == "subscribe" and hub_verify_token == settings.FACEBOOK_WEBHOOK_VERIFY_TOKEN:
        return int(hub_challenge)
    raise HTTPException(status_code=403, detail="Webhook verification failed")


# ─── Webhook event receiver ────────────────────────────────────────────────────

@router.post("/facebook")
async def receive_webhook(request: Request):
    """
    Facebook sends a POST when a live video changes status.
    We look for LIVE status and auto-create + activate the stream.
    """
    payload = await request.json()
    logger.info("FB webhook payload: %s", payload)

    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            status = value.get("status", "")
            video_id = str(value.get("video_id", ""))

            if not video_id:
                continue

            if status == "LIVE":
                await _handle_live_started(video_id, value)
            elif status in ("VOD", "PROCESSING"):
                await _handle_live_ended(video_id)

    # Facebook expects a 200 response quickly
    return {"ok": True}


async def _handle_live_started(video_id: str, value: dict):
    """Create and activate a livestream record when a Facebook Live starts."""
    if not settings.FACEBOOK_DEFAULT_CLASS_ID:
        logger.warning("FACEBOOK_DEFAULT_CLASS_ID not set — cannot auto-create livestream")
        return

    # Don't create duplicates if webhook fires more than once
    existing = await db.get_livestream_by_facebook_video_id(video_id)
    if existing:
        # Already exists — just make sure it's active
        if not existing.get("is_active"):
            from datetime import datetime
            await db.update_livestream_record(
                existing["id"],
                {"is_active": True, "started_at": datetime.utcnow().isoformat()},
            )
            logger.info("Re-activated existing livestream %s", existing["id"])
        return

    # Fetch the video title from Facebook Graph API if possible
    title = value.get("title") or "Live Class"
    group_id = settings.FACEBOOK_DEFAULT_GROUP_ID or None

    from datetime import datetime
    record = await db.create_livestream_record({
        "class_id": settings.FACEBOOK_DEFAULT_CLASS_ID,
        "title": title,
        "facebook_video_id": video_id,
        "facebook_group_id": group_id,
        "is_active": True,
        "is_private": True,
        "started_at": datetime.utcnow().isoformat(),
    })
    logger.info("Auto-created livestream %s for video %s", record.get("id"), video_id)


async def _handle_live_ended(video_id: str):
    """Deactivate the livestream record when the Facebook Live ends."""
    existing = await db.get_livestream_by_facebook_video_id(video_id)
    if existing and existing.get("is_active"):
        from datetime import datetime
        await db.update_livestream_record(
            existing["id"],
            {"is_active": False, "ended_at": datetime.utcnow().isoformat()},
        )
        logger.info("Auto-deactivated livestream %s", existing["id"])
