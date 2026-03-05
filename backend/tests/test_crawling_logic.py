"""크롤링 관련 비즈니스 로직 테스트 — is_relevant 판정, 배송비 포함 최저가, 가격 범위 필터."""

from app.crawlers.base import RankingItem
from app.crawlers.manager import _check_relevance
from app.models.product import Product
from app.services.product_service import _find_lowest, _filter_relevant


class _FakeProduct:
    """_check_relevance 테스트용 가짜 Product."""

    def __init__(self, **kwargs):
        defaults = {
            "id": 1,
            "user_id": 1,
            "name": "테스트 상품",
            "cost_price": 10000,
            "selling_price": 50000,
            "is_active": True,
            "is_price_locked": False,
            "model_code": None,
            "spec_keywords": None,
            "price_filter_min_pct": None,
            "price_filter_max_pct": None,
        }
        defaults.update(kwargs)
        for k, v in defaults.items():
            setattr(self, k, v)


def _make_product(**kwargs):
    """테스트용 Product 객체 생성 헬퍼."""
    return _FakeProduct(**kwargs)


def _make_item(**kwargs) -> RankingItem:
    """테스트용 RankingItem 생성 헬퍼."""
    defaults = {
        "rank": 1,
        "product_name": "경쟁사 상품",
        "price": 45000,
        "mall_name": "경쟁사A",
        "shipping_fee": 0,
        "shipping_fee_type": "free",
        "naver_product_id": "np_001",
    }
    defaults.update(kwargs)
    return RankingItem(**defaults)


class _FakeRanking:
    """_find_lowest, _filter_relevant 테스트용 가짜 KeywordRanking."""

    def __init__(self, **kwargs):
        defaults = {
            "id": 1,
            "keyword_id": 1,
            "rank": 1,
            "product_name": "상품",
            "price": 10000,
            "mall_name": "스토어",
            "naver_product_id": "np_001",
            "is_my_store": False,
            "is_relevant": True,
            "shipping_fee": 0,
        }
        defaults.update(kwargs)
        for k, v in defaults.items():
            setattr(self, k, v)


# ===== _check_relevance 테스트 =====

def test_relevance_no_product():
    """product가 None이면 항상 relevant."""
    item = _make_item()
    is_rel, reason = _check_relevance(item, None)
    assert is_rel is True
    assert reason is None


def test_relevance_no_model_code():
    """model_code가 없으면 항상 relevant."""
    product = _make_product(model_code=None)
    item = _make_item()
    is_rel, reason = _check_relevance(item, product)
    assert is_rel is True
    assert reason is None


def test_relevance_model_code_match():
    """model_code가 상품명에 포함되면 relevant."""
    product = _make_product(model_code="ABC-123")
    item = _make_item(product_name="신형 ABC-123 블랙")
    is_rel, reason = _check_relevance(item, product)
    assert is_rel is True
    assert reason is None


def test_relevance_model_code_mismatch():
    """model_code가 상품명에 없으면 irrelevant."""
    product = _make_product(model_code="ABC-123")
    item = _make_item(product_name="완전 다른 상품 XYZ")
    is_rel, reason = _check_relevance(item, product)
    assert is_rel is False
    assert reason == "model_code"


def test_relevance_spec_keywords_match():
    """model_code + spec_keywords 모두 포함되면 relevant."""
    product = _make_product(model_code="ABC", spec_keywords=["500ml", "화이트"])
    item = _make_item(product_name="ABC 500ml 화이트 에디션")
    is_rel, reason = _check_relevance(item, product)
    assert is_rel is True


def test_relevance_spec_keywords_partial_mismatch():
    """spec_keywords 중 하나라도 없으면 irrelevant."""
    product = _make_product(model_code="ABC", spec_keywords=["500ml", "화이트"])
    item = _make_item(product_name="ABC 500ml 블랙")
    is_rel, reason = _check_relevance(item, product)
    assert is_rel is False
    assert reason == "spec_keywords"


def test_relevance_price_filter_min():
    """가격 범위 필터 — min_pct 미달 시 irrelevant."""
    product = _make_product(
        selling_price=50000,
        price_filter_min_pct=30,  # 최소 15,000원
    )
    item = _make_item(price=10000, shipping_fee=0)  # 총액 10,000 < 15,000
    is_rel, reason = _check_relevance(item, product)
    assert is_rel is False
    assert reason == "price_filter_min"


def test_relevance_price_filter_max():
    """가격 범위 필터 — max_pct 초과 시 irrelevant."""
    product = _make_product(
        selling_price=50000,
        price_filter_max_pct=200,  # 최대 100,000원
    )
    item = _make_item(price=110000, shipping_fee=0)  # 총액 110,000 > 100,000
    is_rel, reason = _check_relevance(item, product)
    assert is_rel is False
    assert reason == "price_filter_max"


def test_relevance_price_filter_within_range():
    """가격 범위 필터 — 범위 내이면 relevant."""
    product = _make_product(
        selling_price=50000,
        price_filter_min_pct=30,   # 최소 15,000원
        price_filter_max_pct=200,  # 최대 100,000원
    )
    item = _make_item(price=45000, shipping_fee=3000)  # 총액 48,000 (범위 내)
    is_rel, reason = _check_relevance(item, product)
    assert is_rel is True
    assert reason is None


def test_relevance_price_filter_includes_shipping():
    """가격 범위 필터가 배송비 포함 총액으로 판별하는지 확인."""
    product = _make_product(
        selling_price=50000,
        price_filter_min_pct=30,  # 최소 15,000원
    )
    # 상품가 14,000 + 배송비 2,000 = 16,000 → 범위 내
    item = _make_item(price=14000, shipping_fee=2000)
    is_rel, reason = _check_relevance(item, product)
    assert is_rel is True


# ===== _find_lowest 테스트 (배송비 포함) =====

def test_find_lowest_empty():
    """빈 리스트이면 None 반환."""
    price, seller = _find_lowest([])
    assert price is None
    assert seller is None


def test_find_lowest_with_shipping():
    """배송비 포함 최저가 계산."""
    rankings = [
        _FakeRanking(price=10000, shipping_fee=3000, mall_name="A"),  # 총액 13,000
        _FakeRanking(price=12000, shipping_fee=0, mall_name="B"),     # 총액 12,000
        _FakeRanking(price=11000, shipping_fee=2000, mall_name="C"),  # 총액 13,000
    ]
    price, seller = _find_lowest(rankings)
    assert price == 12000
    assert seller == "B"


def test_find_lowest_none_shipping():
    """shipping_fee가 None이면 0으로 처리."""
    rankings = [
        _FakeRanking(price=10000, shipping_fee=None, mall_name="A"),  # 총액 10,000
        _FakeRanking(price=9000, shipping_fee=2000, mall_name="B"),   # 총액 11,000
    ]
    price, seller = _find_lowest(rankings)
    assert price == 10000
    assert seller == "A"


# ===== _filter_relevant 테스트 =====

def test_filter_relevant_excludes_blacklist():
    """블랙리스트 naver_product_id가 제외되는지 확인."""
    rankings = [
        _FakeRanking(naver_product_id="np_001", is_relevant=True),
        _FakeRanking(naver_product_id="np_002", is_relevant=True),
        _FakeRanking(naver_product_id="np_003", is_relevant=True),
    ]
    excluded = {"np_002"}
    result = _filter_relevant(rankings, excluded)
    assert len(result) == 2
    ids = {r.naver_product_id for r in result}
    assert "np_002" not in ids


def test_filter_relevant_excludes_irrelevant():
    """is_relevant=False인 항목이 제외되는지 확인."""
    rankings = [
        _FakeRanking(naver_product_id="np_001", is_relevant=True),
        _FakeRanking(naver_product_id="np_002", is_relevant=False),
    ]
    result = _filter_relevant(rankings, set())
    assert len(result) == 1
    assert result[0].naver_product_id == "np_001"
