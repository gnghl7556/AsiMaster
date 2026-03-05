"""User CRUD API 테스트."""

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
