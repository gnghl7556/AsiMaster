"""텔레그램 봇 알림 전송 서비스"""

import logging

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User

logger = logging.getLogger(__name__)

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=10)
    return _client


async def close_client():
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
        _client = None


def _format_telegram_message(alert_type: str | None, title: str, message: str) -> str:
    """알림 타입별 텔레그램 메시지 포맷팅 (HTML)."""
    icons = {
        "price_undercut": "\U0001f6a8",  # 🚨
        "rank_drop": "\U0001f4c9",       # 📉
    }
    icon = icons.get(alert_type or "", "\U0001f514")  # 🔔 기본
    return f"{icon} <b>{title}</b>\n\n{message}"


async def send_telegram_message(chat_id: str, text: str) -> bool:
    """Telegram Bot API sendMessage 호출."""
    if not settings.TELEGRAM_BOT_TOKEN:
        return False

    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    try:
        resp = await _get_client().post(url, json={
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
        })
        if resp.status_code == 200:
            logger.info("텔레그램 전송 성공: chat_id=%s", chat_id)
            return True
        logger.warning("텔레그램 전송 실패: chat_id=%s, status=%s, body=%s", chat_id, resp.status_code, resp.text)
        return False
    except Exception as e:
        logger.error("텔레그램 전송 오류: %s", e)
        return False


async def send_telegram_to_user(
    db: AsyncSession, user_id: int, title: str, message: str,
    alert_type: str | None = None,
) -> bool:
    """user_id로 chat_id 조회 후 텔레그램 전송."""
    if not settings.TELEGRAM_BOT_TOKEN:
        return False

    result = await db.execute(select(User.telegram_chat_id).where(User.id == user_id))
    chat_id = result.scalar_one_or_none()
    if not chat_id:
        return False

    text = _format_telegram_message(alert_type, title, message)
    return await send_telegram_message(chat_id, text)
