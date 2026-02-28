from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Supabase — use service_role key server-side ONLY (never expose to frontend)
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    SUPABASE_ANON_KEY: str

    # Facebook — Login / OAuth App
    FACEBOOK_LOGIN_APP_ID: str
    FACEBOOK_LOGIN_APP_SECRET: str
    FACEBOOK_LOGIN_REDIRECT_URI: str

    # Facebook — Livestream / Video Embed App (App ID only; secret is not used server-side)
    FACEBOOK_LIVESTREAM_APP_ID: str

    # Ollama (local)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"

    # App
    FRONTEND_URL: str
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
