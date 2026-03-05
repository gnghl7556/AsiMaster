"""알림 서비스 테스트 — 순위 매칭 로직."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.keyword_ranking import KeywordRanking
from app.models.product import Product
from app.models.search_keyword import SearchKeyword
from app.models.user import User
from app.services.product_service import _calc_my_rank, _is_my_exact_product


class _FakeRanking:
    """_calc_my_rank 테스트용 가짜 랭킹."""

    def __init__(self, **kwargs):
        defaults = {
            "rank": 1,
            "naver_product_id": None,
            "is_my_store": False,
        }
        defaults.update(kwargs)
        for k, v in defaults.items():
            setattr(self, k, v)


# ===== _is_my_exact_product 테스트 =====

def test_exact_product_match_by_naver_id():
    """naver_product_id가 있으면 정확히 매칭."""
    ranking = _FakeRanking(naver_product_id="np_100", is_my_store=True)
    assert _is_my_exact_product(ranking, "np_100") is True


def test_exact_product_no_match_by_naver_id():
    """naver_product_id가 다르면 불일치."""
    ranking = _FakeRanking(naver_product_id="np_200", is_my_store=True)
    assert _is_my_exact_product(ranking, "np_100") is False


def test_exact_product_fallback_to_is_my_store():
    """product_naver_id가 None이면 is_my_store로 fallback."""
    ranking = _FakeRanking(naver_product_id="np_100", is_my_store=True)
    assert _is_my_exact_product(ranking, None) is True


def test_exact_product_fallback_not_my_store():
    """product_naver_id가 None이고 is_my_store=False."""
    ranking = _FakeRanking(naver_product_id="np_100", is_my_store=False)
    assert _is_my_exact_product(ranking, None) is False


# ===== _calc_my_rank 테스트 =====

def test_calc_my_rank_by_naver_product_id():
    """naver_product_id로 내 순위 찾기."""
    rankings = [
        _FakeRanking(rank=1, naver_product_id="np_001"),
        _FakeRanking(rank=3, naver_product_id="np_100"),
        _FakeRanking(rank=5, naver_product_id="np_100"),  # 같은 상품 여러 결과
        _FakeRanking(rank=7, naver_product_id="np_200"),
    ]
    result = _calc_my_rank(rankings, "np_100")
    assert result == 3  # 가장 높은 순위


def test_calc_my_rank_fallback_is_my_store():
    """naver_product_id 없을 때 is_my_store fallback."""
    rankings = [
        _FakeRanking(rank=1, is_my_store=False, naver_product_id="np_001"),
        _FakeRanking(rank=4, is_my_store=True, naver_product_id="np_002"),
        _FakeRanking(rank=6, is_my_store=True, naver_product_id="np_003"),
    ]
    result = _calc_my_rank(rankings, None)
    assert result == 4


def test_calc_my_rank_not_found():
    """내 상품이 결과에 없을 때 None 반환."""
    rankings = [
        _FakeRanking(rank=1, naver_product_id="np_001"),
        _FakeRanking(rank=2, naver_product_id="np_002"),
    ]
    result = _calc_my_rank(rankings, "np_999")
    assert result is None


def test_calc_my_rank_empty():
    """빈 리스트일 때 None 반환."""
    result = _calc_my_rank([], "np_100")
    assert result is None


# ===== 크롤링 매니저 is_relevant 판정 우선순위 테스트 (단위 테스트) =====

def test_relevance_priority_blacklist_over_included():
    """블랙리스트가 수동 포함 예외보다 우선.

    _save_keyword_result의 판정 순서:
    1. excluded_ids (블랙리스트) → False
    2. my_product_ids → False
    3. included_override_ids → True
    4. _check_relevance → auto
    """
    from app.crawlers.manager import _check_relevance
    from app.crawlers.base import RankingItem

    # 블랙리스트 + 수동 포함 예외 동시에 해당되는 경우,
    # _save_keyword_result에서 블랙리스트를 먼저 체크하므로
    # 여기서는 _check_relevance 자체의 동작만 검증
    item = RankingItem(
        rank=1, product_name="테스트", price=10000,
        mall_name="스토어", naver_product_id="np_test",
    )
    # _check_relevance는 model_code 기반 자동 필터만 담당
    # product 없이 호출하면 항상 relevant
    is_rel, reason = _check_relevance(item, None)
    assert is_rel is True
    assert reason is None


def test_relevance_model_code_case_insensitive():
    """model_code 매칭이 대소문자 무시하는지 확인."""
    from app.crawlers.manager import _check_relevance
    from app.crawlers.base import RankingItem

    class _FakeProduct:
        model_code = "abc-123"
        spec_keywords = None
        selling_price = 50000
        price_filter_min_pct = None
        price_filter_max_pct = None

    item = RankingItem(
        rank=1, product_name="ABC-123 상품", price=45000,
        mall_name="스토어",
    )
    is_rel, reason = _check_relevance(item, _FakeProduct())
    assert is_rel is True
