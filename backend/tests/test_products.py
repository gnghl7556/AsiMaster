"""상품 API 테스트 — CRUD, 복수 삭제, 가격고정 토글, 입력 검증."""

import pytest


@pytest.mark.asyncio
async def test_create_product(client):
    """상품 생성 + 자동 키워드 등록."""
    # 먼저 사업체 생성
    user_resp = await client.post("/api/v1/users", json={"name": "상품테스트용"})
    user_id = user_resp.json()["id"]

    resp = await client.post(f"/api/v1/users/{user_id}/products", json={
        "name": "테스트 상품A",
        "cost_price": 10000,
        "selling_price": 20000,
        "category": "가전",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "테스트 상품A"
    assert data["selling_price"] == 20000
    assert data["category"] == "가전"
    assert data["is_price_locked"] is False


@pytest.mark.asyncio
async def test_get_product_detail(client):
    """상품 상세 조회."""
    user_resp = await client.post("/api/v1/users", json={"name": "상세조회용"})
    user_id = user_resp.json()["id"]

    create_resp = await client.post(f"/api/v1/users/{user_id}/products", json={
        "name": "상세 상품",
        "cost_price": 5000,
        "selling_price": 15000,
    })
    product_id = create_resp.json()["id"]

    resp = await client.get(f"/api/v1/products/{product_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "상세 상품"
    assert data["user_id"] == user_id
    assert "keywords" in data
    assert "competitors" in data
    assert "margin" in data


@pytest.mark.asyncio
async def test_update_product(client):
    """상품 수정."""
    user_resp = await client.post("/api/v1/users", json={"name": "수정테스트용"})
    user_id = user_resp.json()["id"]

    create_resp = await client.post(f"/api/v1/users/{user_id}/products", json={
        "name": "수정전 상품",
        "cost_price": 10000,
        "selling_price": 20000,
    })
    product_id = create_resp.json()["id"]

    resp = await client.put(f"/api/v1/products/{product_id}", json={
        "name": "수정후 상품",
        "selling_price": 25000,
        "model_code": "MD-100",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "수정후 상품"
    assert data["selling_price"] == 25000
    assert data["model_code"] == "MD-100"


@pytest.mark.asyncio
async def test_delete_product(client):
    """상품 삭제 + 404 확인."""
    user_resp = await client.post("/api/v1/users", json={"name": "삭제테스트용"})
    user_id = user_resp.json()["id"]

    create_resp = await client.post(f"/api/v1/users/{user_id}/products", json={
        "name": "삭제될 상품",
        "cost_price": 5000,
        "selling_price": 10000,
    })
    product_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/v1/products/{product_id}")
    assert resp.status_code == 204

    resp = await client.get(f"/api/v1/products/{product_id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_product_not_found(client):
    """존재하지 않는 상품 삭제 시 404."""
    resp = await client.delete("/api/v1/products/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_bulk_delete(client):
    """복수 삭제 — 실제 삭제된 건수 반환."""
    user_resp = await client.post("/api/v1/users", json={"name": "벌크삭제용"})
    user_id = user_resp.json()["id"]

    ids = []
    for i in range(3):
        r = await client.post(f"/api/v1/users/{user_id}/products", json={
            "name": f"벌크삭제 {i}",
            "cost_price": 1000,
            "selling_price": 2000,
        })
        ids.append(r.json()["id"])

    # 존재하는 2개 + 존재하지 않는 1개
    resp = await client.post(f"/api/v1/users/{user_id}/products/bulk-delete", json={
        "product_ids": [ids[0], ids[1], 99999],
    })
    assert resp.status_code == 200
    assert resp.json()["deleted"] == 2


@pytest.mark.asyncio
async def test_price_lock_toggle(client):
    """가격고정 토글 — 활성화 + 비활성화."""
    user_resp = await client.post("/api/v1/users", json={"name": "가격고정용"})
    user_id = user_resp.json()["id"]

    create_resp = await client.post(f"/api/v1/users/{user_id}/products", json={
        "name": "가격고정 상품",
        "cost_price": 5000,
        "selling_price": 10000,
    })
    product_id = create_resp.json()["id"]

    # 활성화
    resp = await client.patch(f"/api/v1/products/{product_id}/price-lock", json={
        "is_locked": True,
        "reason": "최저가보장",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_price_locked"] is True
    assert data["price_lock_reason"] == "최저가보장"

    # 비활성화
    resp = await client.patch(f"/api/v1/products/{product_id}/price-lock", json={
        "is_locked": False,
    })
    data = resp.json()
    assert data["is_price_locked"] is False
    assert data["price_lock_reason"] is None


@pytest.mark.asyncio
async def test_create_product_nonexistent_user(client):
    """존재하지 않는 유저에 상품 생성 시 404."""
    resp = await client.post("/api/v1/users/99999/products", json={
        "name": "없는유저 상품",
        "cost_price": 1000,
        "selling_price": 2000,
    })
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_spec_keywords_validation(client):
    """spec_keywords 21개 초과 시 422 에러."""
    user_resp = await client.post("/api/v1/users", json={"name": "검증테스트용"})
    user_id = user_resp.json()["id"]

    resp = await client.post(f"/api/v1/users/{user_id}/products", json={
        "name": "검증 상품",
        "cost_price": 1000,
        "selling_price": 2000,
        "spec_keywords": [f"kw{i}" for i in range(21)],
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_product_attributes_validation(client):
    """product_attributes 21개 키 초과 시 422 에러."""
    user_resp = await client.post("/api/v1/users", json={"name": "속성검증용"})
    user_id = user_resp.json()["id"]

    resp = await client.post(f"/api/v1/users/{user_id}/products", json={
        "name": "속성 검증 상품",
        "cost_price": 1000,
        "selling_price": 2000,
        "product_attributes": {f"key{i}": f"val{i}" for i in range(21)},
    })
    assert resp.status_code == 422
