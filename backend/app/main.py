import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import auth, livestreams, comments, quizzes, qna, ai, classes, webhooks
from app.config import settings
from app.services.fb_poller import poll_loop

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start background tasks on startup; cancel them on shutdown."""
    poller_task = asyncio.create_task(poll_loop())
    logger.info("App started — FB poller task created.")
    try:
        yield
    finally:
        poller_task.cancel()
        try:
            await poller_task
        except asyncio.CancelledError:
            pass
        logger.info("App shutdown — FB poller task stopped.")


app = FastAPI(
    title="LMS API",
    version="1.0.0",
    lifespan=lifespan,
    # Disable docs in production
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
)

# CORS — allow the configured frontend origin (set FRONTEND_URL on Railway)
# Multiple origins can be comma-separated: https://a.vercel.app,https://b.vercel.app
_origins = [o.strip() for o in settings.FRONTEND_URL.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],   # includes OPTIONS for preflight
    allow_headers=["*"],   # includes Authorization
)

# Routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(livestreams.router, prefix="/api/livestreams", tags=["livestreams"])
app.include_router(comments.router, prefix="/api/comments", tags=["comments"])
app.include_router(quizzes.router, prefix="/api/quizzes", tags=["quizzes"])
app.include_router(qna.router, prefix="/api/qna", tags=["qna"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])
app.include_router(classes.router, prefix="/api/classes", tags=["classes"])
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["webhooks"])


@app.get("/health")
def health_check():
    return {"status": "ok"}
