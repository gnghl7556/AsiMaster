"""커스텀 예외 → HTTP 응답 매핑 테스트."""

import pytest


@pytest.mark.asyncio
async def test_not_found_returns_404(client):
    """NotFoundError → 404 응답 확인 (상품 조회)."""
    resp = await client.get("/api/v1/products/99999")
    assert resp.status_code == 404
    data = resp.json()
    assert "detail" in data


@pytest.mark.asyncio
async def test_not_found_korean_message(client):
    """404 에러 메시지가 한국어인지 확인."""
    resp = await client.get("/api/v1/products/99999")
    detail = resp.json()["detail"]
    # "상품을 찾을 수 없습니다" 또는 유사한 한국어 메시지
    assert any(kw in detail for kw in ["찾을 수 없", "없습니다"])


@pytest.mark.asyncio
async def test_duplicate_user_returns_400(client):
    """중복 사업체 → 400 에러."""
    await client.post("/api/v1/users", json={"name": "중복예외테스트"})
    resp = await client.post("/api/v1/users", json={"name": "중복예외테스트"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_duplicate_excluded_returns_409(client):
    """중복 블랙리스트 추가 → 409 응답."""
    # 사업체 + 상품 생성
    user_resp = await client.post("/api/v1/users", json={"name": "블랙리스트예외"})
    user_id = user_resp.json()["id"]

    prod_resp = await client.post(f"/api/v1/users/{user_id}/products", json={
        "name": "예외 상품",
        "cost_price": 1000,
        "selling_price": 2000,
    })
    product_id = prod_resp.json()["id"]

    # 첫 번째 블랙리스트 추가
    resp1 = await client.post(f"/api/v1/products/{product_id}/excluded", json={
        "naver_product_id": "np_dup_test",
        "naver_product_name": "중복 테스트",
    })
    assert resp1.status_code == 201

    # 동일 naver_product_id로 두 번째 추가 → 409
    resp2 = await client.post(f"/api/v1/products/{product_id}/excluded", json={
        "naver_product_id": "np_dup_test",
    })
    assert resp2.status_code == 409
    assert "detail" in resp2.json()


@pytest.mark.asyncio
async def test_excluded_not_found_on_remove(client):
    """제외 목록에 없는 상품 해제 시 404."""
    user_resp = await client.post("/api/v1/users", json={"name": "해제예외테스트"})
    user_id = user_resp.json()["id"]

    prod_resp = await client.post(f"/api/v1/users/{user_id}/products", json={
        "name": "해제 예외 상품",
        "cost_price": 1000,
        "selling_price": 2000,
    })
    product_id = prod_resp.json()["id"]

    resp = await client.delete(f"/api/v1/products/{product_id}/excluded/nonexistent_id")
    assert resp.status_code == 404
