"""User CRUD API 테스트."""

import pytest


@pytest.mark.asyncio
async def test_create_and_get_user(client):
    resp = await client.post("/api/v1/users", json={"name": "테스트 사업체"})
    assert resp.status_code == 201
    user = resp.json()
    assert user["name"] == "테스트 사업체"
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
