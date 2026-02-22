import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text

from app.api.router import api_router
from app.core.config import settings
from app.core.database import async_session, engine, Base
from app.models import *  # noqa: F401, F403 - ensure all models are registered
from app.models.product import Product
from app.models.search_keyword import SearchKeyword
from app.models.user import User
from app.scheduler.setup import init_scheduler, shutdown_scheduler

logger = logging.getLogger(__name__)


async def apply_schema_changes(session):
    """기존 테이블에 새 컬럼 추가 (create_all로 불가능한 ALTER TABLE)."""
    is_sqlite = "sqlite" in str(engine.url)

    # (테이블명, 컬럼명, 타입, 기본값)
    alter_statements = [
        ("users", "naver_store_name", "VARCHAR(200)", None),
        ("users", "crawl_interval_min", "INTEGER", "60"),
        ("products", "naver_product_id", "VARCHAR(50)", None),
        ("products", "model_code", "VARCHAR(100)", None),
        ("products", "spec_keywords", "JSONB", "'[]'"),
        ("keyword_rankings", "naver_product_id", "VARCHAR(50)", None),
        ("keyword_rankings", "is_relevant", "BOOLEAN", "true"),
        ("search_keywords", "sort_type", "VARCHAR(10)", "'sim'"),
        ("excluded_products", "mall_name", "VARCHAR(200)", None),
    ]
    try:
        if is_sqlite:
            for table, col_name, col_type, default in alter_statements:
                result = await session.execute(text(f"PRAGMA table_info({table})"))
                columns = [row[1] for row in result.fetchall()]
                if col_name not in columns:
                    default_clause = f" DEFAULT {default}" if default else ""
                    await session.execute(text(
                        f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}{default_clause}"
                    ))
        else:
            for table, col_name, col_type, default in alter_statements:
                default_clause = f" DEFAULT {default}" if default else ""
                await session.execute(text(
                    f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col_name} {col_type}{default_clause}"
                ))
        await session.commit()
        logger.info("스키마 변경 적용 완료")
    except Exception as e:
        await session.rollback()
        logger.warning(f"스키마 변경 스킵 (이미 적용됨): {e}")


async def migrate_to_keyword_system(session):
    """기존 Product에 기본 SearchKeyword 자동 생성."""
    try:
        all_products = (await session.execute(select(Product))).scalars().all()
        created = 0
        for product in all_products:
            existing = (await session.execute(
                select(SearchKeyword).where(
                    SearchKeyword.product_id == product.id,
                    SearchKeyword.is_primary == True,
                )
            )).scalars().first()
            if not existing:
                session.add(SearchKeyword(
                    product_id=product.id,
                    keyword=product.name,
                    is_primary=True,
                ))
                created += 1
                logger.info(f"기본 키워드 생성: {product.name} (ID: {product.id})")

        if created > 0:
            await session.commit()
            logger.info(f"키워드 시스템 마이그레이션 완료: {created}개 기본 키워드 생성")
    except Exception as e:
        await session.rollback()
        logger.error(f"키워드 마이그레이션 실패: {e}")


async def backfill_excluded_mall_names(session):
    """기존 excluded_products에 mall_name 역채움 (keyword_rankings 기반)."""
    try:
        await session.execute(text("""
            UPDATE excluded_products ep
            SET mall_name = sub.mall_name
            FROM (
                SELECT DISTINCT kr.naver_product_id, kr.mall_name
                FROM keyword_rankings kr
                WHERE kr.naver_product_id IS NOT NULL
                  AND kr.mall_name IS NOT NULL
                  AND kr.mall_name != ''
            ) sub
            WHERE ep.naver_product_id = sub.naver_product_id
              AND ep.mall_name IS NULL
        """))
        await session.commit()
        logger.info("excluded_products mall_name 역채움 완료")
    except Exception as e:
        await session.rollback()
        logger.warning(f"mall_name 역채움 스킵: {e}")


async def cleanup_old_tables(session):
    """기존 competitors, price_history, platforms 관련 테이블 drop (존재하면)."""
    tables_to_drop = [
        "price_history",
        "competitors",
        "user_platforms",
        "platforms",
    ]
    is_sqlite = "sqlite" in str(engine.url)
    for table in tables_to_drop:
        try:
            if is_sqlite:
                await session.execute(text(f"DROP TABLE IF EXISTS {table}"))
            else:
                await session.execute(text(f"DROP TABLE IF EXISTS {table} CASCADE"))
            logger.info(f"기존 테이블 삭제: {table}")
        except Exception as e:
            logger.warning(f"테이블 삭제 실패 ({table}): {e}")
    await session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 새 테이블 생성
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 스키마 변경 적용
    async with async_session() as session:
        await apply_schema_changes(session)

    # 기존 데이터 마이그레이션
    async with async_session() as session:
        await migrate_to_keyword_system(session)

    # 기존 excluded_products에 mall_name 역채움
    async with async_session() as session:
        await backfill_excluded_mall_names(session)

    # 기존 테이블 정리
    async with async_session() as session:
        await cleanup_old_tables(session)

    init_scheduler()
    yield
    shutdown_scheduler()
    # httpx 클라이언트 정리
    from app.crawlers.manager import crawler
    await crawler.close()


app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
