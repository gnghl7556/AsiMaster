from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.deps import get_db
from app.models.platform import Platform, UserPlatform
from app.models.user import User
from app.schemas.platform import PlatformResponse, UserPlatformResponse, UserPlatformUpdate

router = APIRouter(tags=["platforms"])


@router.get("/platforms", response_model=list[PlatformResponse])
async def get_platforms(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Platform).order_by(Platform.id))
    return result.scalars().all()


@router.get("/users/{user_id}/platforms", response_model=list[UserPlatformResponse])
async def get_user_platforms(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UserPlatform)
        .options(joinedload(UserPlatform.platform))
        .where(UserPlatform.user_id == user_id)
        .order_by(UserPlatform.platform_id)
    )
    user_platforms = result.scalars().all()
    return [
        UserPlatformResponse(
            id=up.id,
            user_id=up.user_id,
            platform_id=up.platform_id,
            platform_name=up.platform.name,
            platform_display_name=up.platform.display_name,
            is_active=up.is_active,
            crawl_interval_min=up.crawl_interval_min,
        )
        for up in user_platforms
    ]


@router.put("/users/{user_id}/platforms/{platform_id}", response_model=UserPlatformResponse)
async def update_user_platform(
    user_id: int, platform_id: int, data: UserPlatformUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(UserPlatform)
        .options(joinedload(UserPlatform.platform))
        .where(UserPlatform.user_id == user_id, UserPlatform.platform_id == platform_id)
    )
    up = result.scalar_one_or_none()
    if not up:
        raise HTTPException(404, "플랫폼 설정을 찾을 수 없습니다.")
    if data.is_active is not None:
        up.is_active = data.is_active
    if data.crawl_interval_min is not None:
        up.crawl_interval_min = data.crawl_interval_min
    await db.flush()
    await db.refresh(up)
    return UserPlatformResponse(
        id=up.id,
        user_id=up.user_id,
        platform_id=up.platform_id,
        platform_name=up.platform.name,
        platform_display_name=up.platform.display_name,
        is_active=up.is_active,
        crawl_interval_min=up.crawl_interval_min,
    )
