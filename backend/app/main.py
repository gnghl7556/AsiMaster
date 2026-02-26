from contextlib import asynccontextmanager
import logging

import sentry_sdk

from app.core.logging import setup_logging

setup_logging()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import case, func, select, text

from app.api.router import api_router
from app.core.config import settings
from app.core.database import async_session, engine, Base
from app.models import *  # noqa: F401, F403 - ensure all models are registered
from app.scheduler.setup import init_scheduler, shutdown_scheduler

logger = logging.getLogger(__name__)

if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
        environment="production",
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 새 테이블 생성 (Alembic이 관리하지 않는 초기 생성용 fallback)
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health")
async def health_check():
    from datetime import timedelta
    from app.scheduler.setup import scheduler
    from app.core.utils import utcnow

    checks = {}
    status = "healthy"

    try:
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
            checks["database"] = "ok"

            from app.models.crawl_log import CrawlLog
            result = await session.execute(
                select(func.max(CrawlLog.created_at))
            )
            last_crawl = result.scalar_one_or_none()
            checks["last_crawl_at"] = last_crawl.isoformat() if last_crawl else None

            # 최근 24시간 크롤링 메트릭스
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
            checks["crawl_metrics_24h"] = {
                "total": total,
                "success": success,
                "failed": total - success,
                "success_rate": round(success / total * 100, 1) if total > 0 else 0,
                "avg_duration_ms": round(row[2]) if row[2] else None,
            }
    except Exception as e:
        checks["database"] = checks.get("database", f"error: {e}")
        checks.setdefault("last_crawl_at", None)
        checks.setdefault("crawl_metrics_24h", None)
        status = "unhealthy"

    checks["scheduler"] = "running" if scheduler.running else "stopped"
    if not scheduler.running:
        status = "degraded" if status == "healthy" else status

    return {"status": status, "checks": checks}
