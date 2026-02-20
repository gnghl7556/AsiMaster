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
    try:
        if is_sqlite:
            # SQLite: pragma로 컬럼 존재 확인 후 추가
            result = await session.execute(text("PRAGMA table_info(users)"))
            columns = [row[1] for row in result.fetchall()]
            if "naver_store_name" not in columns:
                await session.execute(text(
                    "ALTER TABLE users ADD COLUMN naver_store_name VARCHAR(200)"
                ))
        else:
            await session.execute(text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS naver_store_name VARCHAR(200)"
            ))
        await session.commit()
        logger.info("스키마 변경 적용 완료: users.naver_store_name")
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

    # 기존 테이블 정리
    async with async_session() as session:
        await cleanup_old_tables(session)

    init_scheduler()
    yield
    shutdown_scheduler()


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
