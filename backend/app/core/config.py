import logging

from pydantic import model_validator
from pydantic_settings import BaseSettings

_logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    PROJECT_NAME: str = "asimaster"
    API_V1_PREFIX: str = "/api/v1"

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/asimaster"

    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    NAVER_CLIENT_ID: str = ""
    NAVER_CLIENT_SECRET: str = ""

    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    VAPID_CLAIM_EMAIL: str = "admin@asimaster.com"

    SENTRY_DSN: str = ""
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1

    CRAWL_DEFAULT_INTERVAL_MIN: int = 60
    CRAWL_MAX_RETRIES: int = 3
    CRAWL_REQUEST_DELAY_MIN: int = 2
    CRAWL_REQUEST_DELAY_MAX: int = 5
    CRAWL_CONCURRENCY: int = 5
    CRAWL_SHIPPING_CONCURRENCY: int = 3
    CRAWL_SHIPPING_TIMEOUT: int = 8
    CRAWL_API_TIMEOUT: int = 10

    SCHEDULER_CHECK_INTERVAL_MIN: int = 10
    DATA_RETENTION_DAYS: int = 30
    CLEANUP_BATCH_SIZE: int = 10000

    ALERT_DEDUP_HOURS: int = 24
    SPARKLINE_DAYS: int = 7
    MAX_KEYWORDS_PER_PRODUCT: int = 5

    LOG_FORMAT: str = "json"  # "json" | "text"
    LOG_LEVEL: str = "INFO"

    PORT: int = 8000

    model_config = {"env_file": ".env", "extra": "ignore"}

    @model_validator(mode="after")
    def validate_required_secrets(self) -> "Settings":
        missing = []
        if not self.NAVER_CLIENT_ID:
            missing.append("NAVER_CLIENT_ID")
        if not self.NAVER_CLIENT_SECRET:
            missing.append("NAVER_CLIENT_SECRET")
        if missing:
            raise ValueError(f"필수 환경변수 미설정: {', '.join(missing)}")

        # VAPID 키 쌍 일관성 검증
        has_pub = bool(self.VAPID_PUBLIC_KEY)
        has_priv = bool(self.VAPID_PRIVATE_KEY)
        if has_pub != has_priv:
            _logger.warning(
                "VAPID 키가 하나만 설정됨 — 웹 푸시가 작동하지 않습니다. "
                "VAPID_PUBLIC_KEY와 VAPID_PRIVATE_KEY를 모두 설정하세요."
            )

        return self


settings = Settings()
