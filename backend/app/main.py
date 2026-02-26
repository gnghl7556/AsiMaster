import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select, text

from app.api.router import api_router
from app.core.config import settings
from app.core.database import async_session, engine, Base
from app.models import *  # noqa: F401, F403 - ensure all models are registered
from app.scheduler.setup import init_scheduler, shutdown_scheduler

logger = logging.getLogger(__name__)


# (테이블명, 컬럼명, 타입, 기본값)
_ALTER_STATEMENTS = [
    ("users", "naver_store_name", "VARCHAR(200)", None),
    ("users", "crawl_interval_min", "INTEGER", "60"),
    ("products", "naver_product_id", "VARCHAR(50)", None),
    ("products", "model_code", "VARCHAR(100)", None),
    ("products", "spec_keywords", "JSONB", "'[]'"),
    ("keyword_rankings", "naver_product_id", "VARCHAR(50)", None),
    ("keyword_rankings", "is_relevant", "BOOLEAN", "true"),
    ("search_keywords", "sort_type", "VARCHAR(10)", "'sim'"),
    ("excluded_products", "mall_name", "VARCHAR(200)", None),
    ("keyword_rankings", "hprice", "INTEGER", "0"),
    ("keyword_rankings", "brand", "VARCHAR(200)", None),
    ("keyword_rankings", "maker", "VARCHAR(200)", None),
    ("keyword_rankings", "product_type", "VARCHAR(10)", None),
    ("keyword_rankings", "category1", "VARCHAR(100)", None),
    ("keyword_rankings", "category2", "VARCHAR(100)", None),
    ("keyword_rankings", "category3", "VARCHAR(100)", None),
    ("keyword_rankings", "category4", "VARCHAR(100)", None),
    ("keyword_rankings", "shipping_fee", "INTEGER", "0"),
    ("keyword_rankings", "shipping_fee_type", "VARCHAR(20)", "'unknown'"),
    ("products", "price_filter_min_pct", "INTEGER", None),
    ("products", "price_filter_max_pct", "INTEGER", None),
    ("products", "brand", "VARCHAR(100)", None),
    ("products", "maker", "VARCHAR(100)", None),
    ("products", "series", "VARCHAR(100)", None),
    ("products", "capacity", "VARCHAR(50)", None),
    ("products", "color", "VARCHAR(50)", None),
    ("products", "material", "VARCHAR(50)", None),
    ("products", "product_attributes", "JSONB", None),
    ("products", "cost_preset_id", "INTEGER", None),
    ("cost_presets", "updated_at", "TIMESTAMP", "NOW()"),
    ("keyword_rankings", "relevance_reason", "VARCHAR(30)", None),
]

_INDEX_STATEMENTS = [
    "CREATE INDEX IF NOT EXISTS ix_keyword_rankings_naver_product_id ON keyword_rankings (naver_product_id)",
    "CREATE INDEX IF NOT EXISTS ix_keyword_rankings_crawled_at ON keyword_rankings (crawled_at)",
]

_FK_STATEMENTS = [
    """DO $$ BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'fk_products_cost_preset_id'
        ) THEN
            ALTER TABLE products
            ADD CONSTRAINT fk_products_cost_preset_id
            FOREIGN KEY (cost_preset_id) REFERENCES cost_presets(id)
            ON DELETE SET NULL;
        END IF;
    END $$""",
]


async def apply_schema_changes(session):
    """기존 테이블에 새 컬럼 추가 (create_all로 불가능한 ALTER TABLE).

    PostgreSQL: information_schema에서 기존 컬럼을 1회 조회 후 누락분만 ALTER.
    SQLite: PRAGMA table_info로 테이블별 1회 조회.
    """
    is_sqlite = "sqlite" in str(engine.url)

    try:
        if is_sqlite:
            # SQLite: 테이블별 기존 컬럼 캐시
            table_columns: dict[str, set[str]] = {}
            tables_needed = {t for t, _, _, _ in _ALTER_STATEMENTS}
            for table in tables_needed:
                result = await session.execute(text(f"PRAGMA table_info({table})"))
                table_columns[table] = {row[1] for row in result.fetchall()}

            added = 0
            for table, col_name, col_type, default in _ALTER_STATEMENTS:
                if col_name not in table_columns.get(table, set()):
                    default_clause = f" DEFAULT {default}" if default else ""
                    await session.execute(text(
                        f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}{default_clause}"
                    ))
                    added += 1
        else:
            # PostgreSQL: 1회 쿼리로 전체 기존 컬럼 조회
            result = await session.execute(text(
                "SELECT table_name, column_name FROM information_schema.columns "
                "WHERE table_schema = 'public'"
            ))
            existing = {(row[0], row[1]) for row in result.fetchall()}

            added = 0
            for table, col_name, col_type, default in _ALTER_STATEMENTS:
                if (table, col_name) not in existing:
                    default_clause = f" DEFAULT {default}" if default else ""
                    await session.execute(text(
                        f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS "
                        f"{col_name} {col_type}{default_clause}"
                    ))
                    added += 1

            # FK 제약 추가
            for stmt in _FK_STATEMENTS:
                try:
                    await session.execute(text(stmt))
                except Exception:
                    pass

        # 인덱스 추가
        for stmt in _INDEX_STATEMENTS:
            try:
                await session.execute(text(stmt))
            except Exception:
                pass

        await session.commit()
        if added:
            logger.info(f"스키마 변경 적용 완료: {added}개 컬럼 추가")
        else:
            logger.info("스키마 변경 없음 (모두 적용 완료)")
    except Exception as e:
        await session.rollback()
        logger.warning(f"스키마 변경 스킵: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 새 테이블 생성
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 스키마 변경 적용
    async with async_session() as session:
        await apply_schema_changes(session)

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
    from app.scheduler.setup import scheduler

    checks = {}
    status = "healthy"

    # DB ping + 마지막 크롤링 시각 (단일 세션)
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
    except Exception as e:
        checks["database"] = checks.get("database", f"error: {e}")
        checks.setdefault("last_crawl_at", None)
        status = "unhealthy"

    # 스케줄러 상태
    checks["scheduler"] = "running" if scheduler.running else "stopped"
    if not scheduler.running:
        status = "degraded" if status == "healthy" else status

    return {"status": status, "checks": checks}
