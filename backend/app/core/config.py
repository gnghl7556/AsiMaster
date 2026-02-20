from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "asimaster"
    API_V1_PREFIX: str = "/api/v1"

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/asimaster"

    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    ALLOWED_HOSTS: list[str] = ["*"]

    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    VAPID_CLAIM_EMAIL: str = "admin@asimaster.com"

    CRAWL_DEFAULT_INTERVAL_MIN: int = 60
    CRAWL_MAX_RETRIES: int = 3
    CRAWL_REQUEST_DELAY_MIN: int = 2
    CRAWL_REQUEST_DELAY_MAX: int = 5

    PORT: int = 8000

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
