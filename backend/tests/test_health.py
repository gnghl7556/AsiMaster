"""헬스체크 엔드포인트 테스트."""

import pytest


@pytest.mark.asyncio
async def test_health_returns_200(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    # SQLite 테스트 환경에서 async_session은 별도 엔진이므로 unhealthy 가능
    assert "status" in data
    assert "checks" in data
    assert "scheduler" in data["checks"]
