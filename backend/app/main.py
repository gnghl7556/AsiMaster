from contextlib import asynccontextmanager
import logging

import sentry_sdk
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.logging import setup_logging

setup_logging()
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import case, func, select, text
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.database import async_session, engine, Base
from app.core.exceptions import AppError, DuplicateError, NotFoundError
from app.core.rate_limit import limiter
from app.models import *  # noqa: F401, F403 - ensure all models are registered
from app.scheduler.setup import init_scheduler, shutdown_scheduler

logger = logging.getLogger(__name__)

if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
        environment="production",
    )


async def _run_migrations():
    """Alembic 마이그레이션 자동 실행 (별도 스레드에서 asyncio.run 충돌 방지)."""
    import asyncio
    from alembic.config import Config
    from alembic import command
    import os

    alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    alembic_cfg.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
    await asyncio.to_thread(command.upgrade, alembic_cfg, "head")
    logger.info("Alembic 마이그레이션 완료")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Alembic 마이그레이션 실행 (새 컬럼/테이블 자동 적용)
    try:
        await _run_migrations()
    except Exception as e:
        logger.warning("Alembic 마이그레이션 실패, fallback으로 create_all 실행: %s", e)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    init_scheduler()
    yield
    shutdown_scheduler()
    # httpx 클라이언트 정리
    from app.crawlers.manager import crawler
    await crawler.close()
    from app.crawlers.store_scraper import close_client as close_scraper_client
    await close_scraper_client()


app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
)

# Rate Limiting (크롤링 API 남용 방지)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# API Key 인증 제외 경로
_AUTH_EXEMPT_PATHS = {"/health", "/docs", "/redoc", "/openapi.json"}


class ApiKeyMiddleware(BaseHTTPMiddleware):
    """API Key 전역 인증 미들웨어.
    API_KEY 미설정 시 모든 요청 통과 (하위호환).
    """

    async def dispatch(self, request: Request, call_next):
        if settings.API_KEY and request.url.path not in _AUTH_EXEMPT_PATHS:
            api_key = request.headers.get("X-API-Key")
            if api_key != settings.API_KEY:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Invalid or missing API key"},
                )
        return await call_next(request)


app.add_middleware(ApiKeyMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


# 커스텀 예외 → HTTP 응답 전역 핸들러
@app.exception_handler(NotFoundError)
async def not_found_handler(request: Request, exc: NotFoundError):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(DuplicateError)
async def duplicate_handler(request: Request, exc: DuplicateError):
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(status_code=500, content={"detail": str(exc)})


async def _get_crawl_metrics(session) -> dict:
    """최근 24시간 크롤링 메트릭스 조회."""
    from datetime import timedelta
    from app.core.utils import utcnow
    from app.models.crawl_log import CrawlLog

    result = await session.execute(
        select(func.max(CrawlLog.created_at))
    )
    last_crawl = result.scalar_one_or_none()

    since_24h = utcnow() - timedelta(hours=24)
    metrics_result = await session.execute(
        select(
            func.count(CrawlLog.id),
            func.sum(case((CrawlLog.status == "success", 1), else_=0)),
            func.avg(CrawlLog.duration_ms),
        ).where(CrawlLog.created_at >= since_24h)
    )
    row = metrics_result.one()
    total = row[0] or 0
    success = row[1] or 0

    return {
        "last_crawl_at": last_crawl.isoformat() if last_crawl else None,
        "crawl_metrics_24h": {
            "total": total,
            "success": success,
            "failed": total - success,
            "success_rate": round(success / total * 100, 1) if total > 0 else 0,
            "avg_duration_ms": round(row[2]) if row[2] else None,
        },
    }


@app.get("/health")
async def health_check():
    from app.scheduler.setup import scheduler

    checks = {}
    status = "healthy"

    try:
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
            checks["database"] = "ok"
            metrics = await _get_crawl_metrics(session)
            checks["last_crawl_at"] = metrics["last_crawl_at"]
            checks["crawl_metrics_24h"] = metrics["crawl_metrics_24h"]
    except Exception as e:
        logger.error("Health check DB 오류: %s", e)
        checks["database"] = checks.get("database", "database unavailable")
        checks.setdefault("last_crawl_at", None)
        checks.setdefault("crawl_metrics_24h", None)
        status = "unhealthy"

    checks["scheduler"] = "running" if scheduler.running else "stopped"
    if not scheduler.running:
        status = "degraded" if status == "healthy" else status

    return {"status": status, "checks": checks}
