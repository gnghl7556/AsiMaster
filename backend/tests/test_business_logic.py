"""비즈니스 로직 단위 테스트 — 가격 상태 판정 + 마진 계산."""

from app.services.product_service import calculate_status, calculate_margin


def test_status_winning_when_no_competitor():
    assert calculate_status(10000, None) == "winning"


def test_status_winning_when_price_equal():
    assert calculate_status(10000, 10000) == "winning"


def test_status_winning_when_cheaper():
    assert calculate_status(9000, 10000) == "winning"


def test_status_close_within_3_percent():
    # 10300 vs 10000 → 3.0% → close
    assert calculate_status(10300, 10000) == "close"


def test_status_losing_above_3_percent():
    # 10400 vs 10000 → 4.0% → losing
    assert calculate_status(10400, 10000) == "losing"


def test_status_losing_when_zero():
    assert calculate_status(10000, 0) == "losing"


def test_margin_fixed_costs():
    result = calculate_margin(
        selling_price=50000,
        cost_price=30000,
        cost_items=[
            {"name": "택배비", "type": "fixed", "value": 3000},
        ],
    )
    assert result["total_costs"] == 3000
    assert result["net_margin"] == 17000  # 50000 - 30000 - 3000
    assert result["margin_percent"] == 34.0


def test_margin_percent_costs():
    result = calculate_margin(
        selling_price=100000,
        cost_price=60000,
        cost_items=[
            {"name": "수수료", "type": "percent", "value": 10},  # 10000
            {"name": "배송", "type": "fixed", "value": 3000},
        ],
    )
    assert result["total_costs"] == 13000
    assert result["net_margin"] == 27000  # 100000 - 60000 - 13000


def test_margin_no_costs():
    result = calculate_margin(10000, 5000, [])
    assert result["net_margin"] == 5000
    assert result["total_costs"] == 0
