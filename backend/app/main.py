from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import auth, livestreams, comments, quizzes, qna, ai
from app.config import settings

app = FastAPI(
    title="LMS API",
    version="1.0.0",
    # Disable docs in production
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
)

# CORS — only allow the configured frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# Routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(livestreams.router, prefix="/api/livestreams", tags=["livestreams"])
app.include_router(comments.router, prefix="/api/comments", tags=["comments"])
app.include_router(quizzes.router, prefix="/api/quizzes", tags=["quizzes"])
app.include_router(qna.router, prefix="/api/qna", tags=["qna"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])


@app.get("/health")
def health_check():
    return {"status": "ok"}
