"""User CRUD API 테스트."""

from unittest.mock import patch

import pytest


@pytest.mark.asyncio
async def test_create_and_get_user(client):
    resp = await client.post("/api/v1/users", json={"name": "테스트 사업체"})
    assert resp.status_code == 201
    user = resp.json()
    assert user["name"] == "테스트 사업체"
    assert user["has_password"] is False
    user_id = user["id"]

    resp = await client.get(f"/api/v1/users/{user_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "테스트 사업체"

    # 기본 알림 설정 자동 생성 확인
    resp = await client.get(f"/api/v1/users/{user_id}/alert-settings")
    assert resp.status_code == 200
    settings = resp.json()
    assert len(settings) == 2
    types = {s["alert_type"] for s in settings}
    assert types == {"price_undercut", "rank_drop"}
    assert all(s["is_enabled"] for s in settings)


@pytest.mark.asyncio
async def test_create_duplicate_user(client):
    await client.post("/api/v1/users", json={"name": "중복"})
    resp = await client.post("/api/v1/users", json={"name": "중복"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_update_user(client):
    resp = await client.post("/api/v1/users", json={"name": "수정전"})
    user_id = resp.json()["id"]

    resp = await client.put(f"/api/v1/users/{user_id}", json={"name": "수정후", "crawl_interval_min": 30})
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "수정후"
    assert data["crawl_interval_min"] == 30


@pytest.mark.asyncio
async def test_delete_user(client):
    resp = await client.post("/api/v1/users", json={"name": "삭제될"})
    user_id = resp.json()["id"]

    resp = await client.delete(f"/api/v1/users/{user_id}")
    assert resp.status_code == 204

    resp = await client.get(f"/api/v1/users/{user_id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_user_with_password(client):
    resp = await client.post("/api/v1/users", json={"name": "비번사업체", "password": "test1234"})
    assert resp.status_code == 201
    user = resp.json()
    assert user["has_password"] is True
    assert "password_hash" not in user


@pytest.mark.asyncio
async def test_verify_password_success(client):
    resp = await client.post("/api/v1/users", json={"name": "인증테스트", "password": "mypass"})
    user_id = resp.json()["id"]

    resp = await client.post(f"/api/v1/users/{user_id}/verify-password", json={"password": "mypass"})
    assert resp.status_code == 200
    assert resp.json()["verified"] is True


@pytest.mark.asyncio
async def test_verify_password_fail(client):
    resp = await client.post("/api/v1/users", json={"name": "인증실패", "password": "correct"})
    user_id = resp.json()["id"]

    resp = await client.post(f"/api/v1/users/{user_id}/verify-password", json={"password": "wrong"})
    assert resp.status_code == 200
    assert resp.json()["verified"] is False


@pytest.mark.asyncio
async def test_verify_no_password_user(client):
    resp = await client.post("/api/v1/users", json={"name": "노비번"})
    user_id = resp.json()["id"]

    resp = await client.post(f"/api/v1/users/{user_id}/verify-password", json={"password": "anything"})
    assert resp.status_code == 200
    assert resp.json()["verified"] is True


@pytest.mark.asyncio
async def test_update_password_and_remove(client):
    resp = await client.post("/api/v1/users", json={"name": "비번변경"})
    user_id = resp.json()["id"]
    assert resp.json()["has_password"] is False

    # 비밀번호 설정
    resp = await client.put(f"/api/v1/users/{user_id}", json={"password": "newpass"})
    assert resp.json()["has_password"] is True

    # 비밀번호 검증
    resp = await client.post(f"/api/v1/users/{user_id}/verify-password", json={"password": "newpass"})
    assert resp.json()["verified"] is True

    # 비밀번호 제거
    resp = await client.put(f"/api/v1/users/{user_id}", json={"remove_password": True})
    assert resp.json()["has_password"] is False


@pytest.mark.asyncio
async def test_telegram_chat_id(client):
    resp = await client.post("/api/v1/users", json={"name": "텔레그램테스트"})
    user_id = resp.json()["id"]
    assert resp.json()["telegram_chat_id"] is None

    # chat_id 설정
    resp = await client.put(f"/api/v1/users/{user_id}", json={"telegram_chat_id": "123456789"})
    assert resp.status_code == 200
    assert resp.json()["telegram_chat_id"] == "123456789"

    # chat_id 해제 (빈 문자열)
    resp = await client.put(f"/api/v1/users/{user_id}", json={"telegram_chat_id": ""})
    assert resp.status_code == 200
    assert resp.json()["telegram_chat_id"] is None


@pytest.mark.asyncio
async def test_telegram_test_no_chat_id(client):
    """chat_id 미설정 상태에서 telegram-test 호출 → 400."""
    resp = await client.post("/api/v1/users", json={"name": "텔레노챗"})
    user_id = resp.json()["id"]

    resp = await client.post(f"/api/v1/users/{user_id}/telegram-test")
    assert resp.status_code == 400
    assert "chat_id" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_telegram_test_no_bot_token(client):
    """BOT_TOKEN 미설정 환경에서 telegram-test 호출 → 400."""
    resp = await client.post("/api/v1/users", json={"name": "텔레노토큰"})
    user_id = resp.json()["id"]

    # chat_id 설정
    await client.put(f"/api/v1/users/{user_id}", json={"telegram_chat_id": "999"})

    with patch("app.core.config.settings.TELEGRAM_BOT_TOKEN", ""):
        resp = await client.post(f"/api/v1/users/{user_id}/telegram-test")
    assert resp.status_code == 400
    assert "TELEGRAM_BOT_TOKEN" in resp.json()["detail"]
