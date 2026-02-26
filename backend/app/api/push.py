from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_db
from app.models.push_subscription import PushSubscription
from app.schemas.push import PushSubscriptionCreate, PushSubscriptionResponse, VapidPublicKeyResponse

router = APIRouter(tags=["push"])


@router.get("/push/vapid-public-key", response_model=VapidPublicKeyResponse)
async def get_vapid_public_key():
    return {"public_key": settings.VAPID_PUBLIC_KEY}


@router.post("/push/subscribe", response_model=PushSubscriptionResponse, status_code=201)
async def subscribe_push(data: PushSubscriptionCreate, db: AsyncSession = Depends(get_db)):
    # 기존 구독이 있으면 업데이트
    result = await db.execute(
        select(PushSubscription).where(PushSubscription.endpoint == data.endpoint)
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.user_id = data.user_id
        existing.p256dh = data.p256dh
        existing.auth = data.auth
        await db.flush()
        await db.refresh(existing)
        return existing

    sub = PushSubscription(
        user_id=data.user_id,
        endpoint=data.endpoint,
        p256dh=data.p256dh,
        auth=data.auth,
    )
    db.add(sub)
    await db.flush()
    await db.refresh(sub)
    return sub


@router.delete("/push/subscribe", status_code=204)
async def unsubscribe_push(endpoint: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PushSubscription).where(PushSubscription.endpoint == endpoint)
    )
    sub = result.scalar_one_or_none()
    if sub:
        await db.delete(sub)
