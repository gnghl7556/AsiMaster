"""웹 푸시 알림 전송 서비스"""

import json
import logging

from pywebpush import webpush, WebPushException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.push_subscription import PushSubscription

logger = logging.getLogger(__name__)


def _get_vapid_claims() -> dict:
    return {"sub": f"mailto:{settings.VAPID_CLAIM_EMAIL}"}


async def send_push_to_user(db: AsyncSession, user_id: int, title: str, body: str, data: dict | None = None):
    """특정 유저의 모든 푸시 구독에 알림 전송."""
    if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
        logger.debug("VAPID 키 미설정 - 웹 푸시 전송 스킵")
        return

    result = await db.execute(
        select(PushSubscription).where(PushSubscription.user_id == user_id)
    )
    subscriptions = result.scalars().all()

    if not subscriptions:
        return

    payload = json.dumps({"title": title, "body": body, "data": data or {}}, ensure_ascii=False)

    for sub in subscriptions:
        subscription_info = {
            "endpoint": sub.endpoint,
            "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
        }
        try:
            webpush(
                subscription_info=subscription_info,
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims=_get_vapid_claims(),
            )
            logger.info(f"푸시 전송 성공: user_id={user_id}")
        except WebPushException as e:
            logger.warning(f"푸시 전송 실패: user_id={user_id} - {e}")
            if e.response and e.response.status_code in (404, 410):
                # 구독 만료/해제 - 삭제
                await db.delete(sub)
                logger.info(f"만료된 푸시 구독 삭제: {sub.endpoint[:50]}...")
        except Exception as e:
            logger.error(f"푸시 전송 오류: {e}")
