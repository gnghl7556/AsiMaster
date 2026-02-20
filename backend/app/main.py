from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.api.router import api_router
from app.core.config import settings
from app.core.database import async_session, engine, Base
from app.models import *  # noqa: F401, F403 - ensure all models are registered
from app.models.competitor import Competitor
from app.models.platform import Platform, UserPlatform
from app.models.product import Product
from app.models.user import User
from app.scheduler.setup import init_scheduler, shutdown_scheduler


async def seed_platforms(session):
    """기본 플랫폼 4개 시드 데이터"""
    result = await session.execute(select(Platform))
    if result.scalars().first():
        return

    platforms = [
        Platform(name="naver", display_name="네이버", base_url="https://shopping.naver.com"),
        Platform(name="coupang", display_name="쿠팡", base_url="https://www.coupang.com"),
        Platform(name="gmarket", display_name="지마켓", base_url="https://www.gmarket.co.kr"),
        Platform(name="auction", display_name="옥션", base_url="https://www.auction.co.kr"),
    ]
    session.add_all(platforms)
    await session.commit()


async def migrate_to_naver_api(session):
    """기존 상품에 네이버 Competitor 자동 생성, 쿠팡/지마켓/옥션 비활성화"""
    import logging
    logger = logging.getLogger(__name__)

    # 네이버 플랫폼 조회
    naver = (await session.execute(
        select(Platform).where(Platform.name == "naver")
    )).scalars().first()
    if not naver:
        return

    # 쿠팡/지마켓/옥션 Competitor 비활성화
    non_naver_platforms = (await session.execute(
        select(Platform).where(Platform.name.in_(["coupang", "gmarket", "auction"]))
    )).scalars().all()
    non_naver_ids = [p.id for p in non_naver_platforms]

    if non_naver_ids:
        result = await session.execute(
            select(Competitor).where(
                Competitor.platform_id.in_(non_naver_ids),
                Competitor.is_active == True,
            )
        )
        for comp in result.scalars().all():
            comp.is_active = False

    # 네이버 Competitor가 없는 상품에 자동 생성
    all_products = (await session.execute(select(Product))).scalars().all()
    for product in all_products:
        existing = (await session.execute(
            select(Competitor).where(
                Competitor.product_id == product.id,
                Competitor.platform_id == naver.id,
            )
        )).scalars().first()
        if not existing:
            session.add(Competitor(
                product_id=product.id,
                platform_id=naver.id,
                url="",
            ))
            logger.info(f"네이버 Competitor 자동 생성: {product.name} (ID: {product.id})")

    await session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_session() as session:
        await seed_platforms(session)
    async with async_session() as session:
        await migrate_to_naver_api(session)
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
