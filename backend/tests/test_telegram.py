"""send_telegram_message 단위 테스트 (mocking 기반)."""

from unittest.mock import AsyncMock, patch

import pytest

from app.services.telegram_service import send_telegram_message, _format_telegram_message


@pytest.mark.asyncio
async def test_send_telegram_success():
    """httpx 응답 200 → True 반환."""
    mock_resp = AsyncMock()
    mock_resp.status_code = 200

    mock_client = AsyncMock()
    mock_client.post.return_value = mock_resp
    mock_client.is_closed = False

    with patch("app.services.telegram_service.settings") as mock_settings, \
         patch("app.services.telegram_service._get_client", return_value=mock_client):
        mock_settings.TELEGRAM_BOT_TOKEN = "fake-token"
        result = await send_telegram_message("123", "테스트")

    assert result is True
    mock_client.post.assert_called_once()


@pytest.mark.asyncio
async def test_send_telegram_failure():
    """httpx 응답 400 → False 반환."""
    mock_resp = AsyncMock()
    mock_resp.status_code = 400
    mock_resp.text = "Bad Request"

    mock_client = AsyncMock()
    mock_client.post.return_value = mock_resp
    mock_client.is_closed = False

    with patch("app.services.telegram_service.settings") as mock_settings, \
         patch("app.services.telegram_service._get_client", return_value=mock_client):
        mock_settings.TELEGRAM_BOT_TOKEN = "fake-token"
        result = await send_telegram_message("123", "테스트")

    assert result is False


@pytest.mark.asyncio
async def test_send_telegram_no_token():
    """BOT_TOKEN 빈값 → False 반환 (API 호출 없음)."""
    mock_client = AsyncMock()

    with patch("app.services.telegram_service.settings") as mock_settings, \
         patch("app.services.telegram_service._get_client", return_value=mock_client):
        mock_settings.TELEGRAM_BOT_TOKEN = ""
        result = await send_telegram_message("123", "테스트")

    assert result is False
    mock_client.post.assert_not_called()


def test_format_price_undercut():
    """price_undercut 타입 메시지 포맷."""
    text = _format_telegram_message("price_undercut", "상품A - 최저가 이탈", "쿠팡 9,800원")
    assert "\U0001f6a8" in text
    assert "<b>상품A - 최저가 이탈</b>" in text
    assert "쿠팡 9,800원" in text


def test_format_rank_drop():
    """rank_drop 타입 메시지 포맷."""
    text = _format_telegram_message("rank_drop", "상품B - 순위 하락", "2위 → 5위")
    assert "\U0001f4c9" in text
    assert "<b>상품B - 순위 하락</b>" in text


def test_format_default():
    """알 수 없는 타입 → 기본 아이콘."""
    text = _format_telegram_message(None, "제목", "내용")
    assert "\U0001f514" in text
