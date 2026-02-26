from datetime import timedelta

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.utils import utcnow
from app.models.alert import Alert
from app.models.crawl_log import CrawlLog
from app.models.excluded_product import ExcludedProduct
from app.models.keyword_ranking import KeywordRanking
from app.models.product import Product
from app.models.search_keyword import SearchKeyword
from app.services.product_service import (
    _fetch_latest_rankings,
    _filter_relevant,
    _find_lowest,
    calculate_margin,
    calculate_status,
)


async def get_dashboard_summary(db: AsyncSession, user_id: int) -> dict:
    """대시보드 요약 — sparkline/rank_change 없이 경량 쿼리."""
    # 상품 + 키워드 + 비용항목 로드 (rankings는 별도 조회)
    result = await db.execute(
        select(Product)
        .options(selectinload(Product.keywords))
        .options(selectinload(Product.cost_items))
        .where(Product.user_id == user_id, Product.is_active == True)
    )
    products = result.scalars().unique().all()

    if not products:
        return _empty_summary(db, user_id)

    # 키워드 ID 수집
    all_keyword_ids: list[int] = []
    product_keyword_map: dict[int, list[int]] = {}
    product_active_keywords: dict[int, list] = {}
    for p in products:
        active = [kw for kw in p.keywords if kw.is_active]
        product_active_keywords[p.id] = active
        kw_ids = [kw.id for kw in active]
        product_keyword_map[p.id] = kw_ids
        all_keyword_ids.extend(kw_ids)

    # 블랙리스트 조회
    product_ids = [p.id for p in products]
    excluded_ids_by_product: dict[int, set[str]] = {pid: set() for pid in product_ids}
    if product_ids:
        ex_result = await db.execute(
            select(ExcludedProduct).where(ExcludedProduct.product_id.in_(product_ids))
        )
        for ep in ex_result.scalars().all():
            excluded_ids_by_product[ep.product_id].add(ep.naver_product_id)

    # 최신 rankings 1회 배치 조회 (sparkline/rank_change 생략)
    all_latest = await _fetch_latest_rankings(db, all_keyword_ids)

    status_counts = {"winning": 0, "close": 0, "losing": 0}
    margins = []
    last_crawled = None
    active_count = 0
    locked_count = 0

    for product in products:
        if product.is_price_locked:
            locked_count += 1
            continue
        active_count += 1

        kw_ids = product_keyword_map[product.id]
        excluded_ids = excluded_ids_by_product.get(product.id, set())

        latest_rankings = []
        for kid in kw_ids:
            latest_rankings.extend(all_latest.get(kid, []))

        relevant = _filter_relevant(latest_rankings, excluded_ids)
        lowest_price, _ = _find_lowest(relevant)
        status = calculate_status(product.selling_price, lowest_price)
        status_counts[status] = status_counts.get(status, 0) + 1

        cost_items_data = [
            {"name": ci.name, "type": ci.type, "value": float(ci.value)}
            for ci in product.cost_items
        ]
        margin = calculate_margin(product.selling_price, product.cost_price, cost_items_data)
        if margin["margin_percent"] is not None:
            margins.append(margin["margin_percent"])

        active_kws = product_active_keywords[product.id]
        for kw in active_kws:
            if kw.last_crawled_at:
                if last_crawled is None or kw.last_crawled_at > last_crawled:
                    last_crawled = kw.last_crawled_at

    avg_margin = round(sum(margins) / len(margins), 1) if margins else None

    # 읽지 않은 알림 수
    unread_result = await db.execute(
        select(func.count(Alert.id)).where(Alert.user_id == user_id, Alert.is_read == False)
    )
    unread_alerts = unread_result.scalar() or 0

    # 크롤링 성공률 (최근 100건)
    log_result = await db.execute(
        select(CrawlLog.status)
        .order_by(CrawlLog.created_at.desc())
        .limit(100)
    )
    logs = log_result.scalars().all()
    success_rate = None
    if logs:
        success_count = sum(1 for s in logs if s == "success")
        success_rate = round((success_count / len(logs)) * 100, 1)

    return {
        "total_products": len(products),
        "active_products": active_count,
        "price_locked_products": locked_count,
        "status_counts": status_counts,
        "avg_margin_percent": avg_margin,
        "unread_alerts": unread_alerts,
        "last_crawled_at": last_crawled,
        "crawl_success_rate": success_rate,
    }


async def _empty_summary(db: AsyncSession, user_id: int) -> dict:
    unread_result = await db.execute(
        select(func.count(Alert.id)).where(Alert.user_id == user_id, Alert.is_read == False)
    )
    unread_alerts = unread_result.scalar() or 0
    return {
        "total_products": 0,
        "active_products": 0,
        "price_locked_products": 0,
        "status_counts": {"winning": 0, "close": 0, "losing": 0},
        "avg_margin_percent": None,
        "unread_alerts": unread_alerts,
        "last_crawled_at": None,
        "crawl_success_rate": None,
    }
