"""
Facebook Live Graph API Poller
==============================
Replaces Facebook webhooks (which no longer work for private groups).

Every POLL_INTERVAL seconds this task calls:
    GET https://graph.facebook.com/v25.0/{target_id}/live_videos?status=LIVE

- If FACEBOOK_DEFAULT_GROUP_ID is set  → polls that group's live videos
- Otherwise                            → polls the user's own live videos

When a new live video is detected it creates a Supabase livestream record.
When a live video disappears from the response it marks the record inactive.

Required env vars (set in Railway):
    FACEBOOK_POLL_USER_TOKEN  — long-lived User Access Token (valid 60 days)
    FACEBOOK_POLL_USER_ID     — your Facebook numeric user ID

Optional:
    FACEBOOK_DEFAULT_GROUP_ID — poll a specific group instead of the user feed
"""

import asyncio
import logging
from datetime import datetime, timezone

import httpx

from app.config import settings
from app.services import supabase_service

logger = logging.getLogger(__name__)

POLL_INTERVAL = 60  # seconds between Graph API calls

# In-memory set of facebook_video_id values currently known to be LIVE.
# Reset on service restart; the first poll re-discovers any active streams.
_active_video_ids: set[str] = set()


# ─── Public entry point ───────────────────────────────────────────────────────

async def poll_loop() -> None:
    """
    Background task: poll Facebook Graph API for live videos.
    Starts only when FACEBOOK_POLL_USER_TOKEN is configured.
    """
    if not settings.FACEBOOK_POLL_USER_TOKEN:
        logger.info("FB Poller: FACEBOOK_POLL_USER_TOKEN not set — polling disabled.")
        return

    target_id = settings.FACEBOOK_DEFAULT_GROUP_ID or settings.FACEBOOK_POLL_USER_ID
    if not target_id:
        logger.info(
            "FB Poller: set FACEBOOK_POLL_USER_ID (or FACEBOOK_DEFAULT_GROUP_ID) to enable polling."
        )
        return

    logger.info(
        "FB Poller: started — target=%s  interval=%ds", target_id, POLL_INTERVAL
    )

    async with httpx.AsyncClient(timeout=15) as client:
        while True:
            try:
                await _check(client, target_id)
            except asyncio.CancelledError:
                logger.info("FB Poller: stopped.")
                raise
            except Exception as exc:  # pragma: no cover
                logger.warning("FB Poller: unhandled error: %s", exc)
            await asyncio.sleep(POLL_INTERVAL)


# ─── Internal helpers ─────────────────────────────────────────────────────────

async def _check(client: httpx.AsyncClient, target_id: str) -> None:
    """One poll cycle: fetch live videos and sync with Supabase."""
    resp = await client.get(
        f"https://graph.facebook.com/v25.0/{target_id}/live_videos",
        params={
            "status": "LIVE",
            "fields": "id,title,description,status",
            "access_token": settings.FACEBOOK_POLL_USER_TOKEN,
        },
    )

    if resp.status_code == 400:
        body = resp.json()
        err = body.get("error", {})
        # Token expired — log clearly so the admin knows to refresh it
        if err.get("code") in (190, 102):
            logger.error(
                "FB Poller: access token expired or invalid. "
                "Please generate a new long-lived token and update FACEBOOK_POLL_USER_TOKEN in Railway."
            )
            # Back off for 10 minutes before retrying (don't spam the log)
            await asyncio.sleep(600)
            return
        logger.warning("FB Poller: Graph API 400: %s", err.get("message", resp.text[:200]))
        return

    if resp.is_error:
        logger.warning("FB Poller: Graph API %d: %s", resp.status_code, resp.text[:200])
        return

    live_videos: list[dict] = resp.json().get("data", [])
    current_ids = {v["id"] for v in live_videos}

    # ── New streams that just started ────────────────────────────────────────
    for video in live_videos:
        vid_id = video["id"]
        if vid_id not in _active_video_ids:
            logger.info("FB Poller: new live stream detected → %s", vid_id)
            await _upsert_live(video)
            _active_video_ids.add(vid_id)

    # ── Streams that just ended ───────────────────────────────────────────────
    ended = _active_video_ids - current_ids
    for vid_id in ended:
        logger.info("FB Poller: live stream ended → %s", vid_id)
        await _mark_ended(vid_id)
        _active_video_ids.discard(vid_id)


async def _upsert_live(video: dict) -> None:
    """Create a Supabase livestream record for a newly detected live video."""
    vid_id = video["id"]
    title = (video.get("title") or "Facebook Live").strip() or "Facebook Live"

    # Avoid duplicates if the service was restarted mid-stream
    existing = await supabase_service.get_livestream_by_facebook_video_id(vid_id)
    if existing:
        # Stream already in DB — just make sure is_active is True
        if not existing.get("is_active"):
            await supabase_service.update_livestream_record(
                existing["id"], {"is_active": True}
            )
        _active_video_ids.add(vid_id)
        return

    data: dict = {
        "title": title,
        "facebook_video_id": vid_id,
        "is_active": True,
        "is_private": False,
        "started_at": datetime.now(timezone.utc).isoformat(),
    }
    if settings.FACEBOOK_DEFAULT_GROUP_ID:
        data["facebook_group_id"] = settings.FACEBOOK_DEFAULT_GROUP_ID
    if settings.FACEBOOK_DEFAULT_CLASS_ID:
        data["class_id"] = settings.FACEBOOK_DEFAULT_CLASS_ID

    try:
        await supabase_service.create_livestream_record(data)
        logger.info("FB Poller: created livestream record for video %s", vid_id)
    except Exception as exc:
        logger.warning("FB Poller: failed to create record for %s: %s", vid_id, exc)


async def _mark_ended(vid_id: str) -> None:
    """Mark a livestream as inactive when the Facebook Live ends."""
    try:
        await supabase_service.deactivate_livestream_by_video_id(vid_id)
        logger.info("FB Poller: marked video %s as inactive", vid_id)
    except Exception as exc:
        logger.warning("FB Poller: failed to deactivate %s: %s", vid_id, exc)
