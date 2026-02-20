from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.api.router import api_router
from app.core.config import settings
from app.core.database import async_session, engine, Base
from app.models import *  # noqa: F401, F403 - ensure all models are registered
from app.models.platform import Platform, UserPlatform
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


async def init_user_platforms(session):
    """새 사용자 생성 시 기본 플랫폼 설정 자동 생성을 위한 이벤트 리스너 대체"""
    pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_session() as session:
        await seed_platforms(session)
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
