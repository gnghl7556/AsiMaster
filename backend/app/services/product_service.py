from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.cost import CostItem
from app.models.keyword_ranking import KeywordRanking
from app.models.product import Product
from app.models.search_keyword import SearchKeyword


def calculate_status(selling_price: int, lowest_price: int | None) -> str:
    if lowest_price is None:
        return "winning"
    if selling_price <= lowest_price:
        return "winning"
    gap_percent = ((selling_price - lowest_price) / lowest_price) * 100
    if gap_percent <= 3.0:
        return "close"
    return "losing"


def calculate_margin(selling_price: int, cost_price: int, cost_items: list) -> dict:
    total_costs = 0
    calculated_items = []
    for item in cost_items:
        if item["type"] == "percent":
            calculated = int(selling_price * item["value"] / 100)
        else:
            calculated = int(item["value"])
        total_costs += calculated
        calculated_items.append({**item, "calculated": calculated})

    net_margin = selling_price - cost_price - total_costs
    margin_percent = round((net_margin / selling_price) * 100, 1) if selling_price > 0 else 0

    return {
        "selling_price": selling_price,
        "cost_price": cost_price,
        "total_costs": total_costs,
        "cost_items": calculated_items,
        "net_margin": net_margin,
        "margin_percent": margin_percent,
    }


def _get_latest_rankings(keywords: list) -> list:
    """각 키워드별 가장 최근 crawled_at의 rankings만 반환."""
    all_rankings = []
    for kw in keywords:
        if not kw.rankings:
            continue
        latest_time = max(r.crawled_at for r in kw.rankings)
        latest = [r for r in kw.rankings if r.crawled_at == latest_time]
        all_rankings.extend(latest)
    return all_rankings


STATUS_ORDER = {"losing": 0, "close": 1, "winning": 2}


def _calc_rank_change(keywords: list) -> int | None:
    """키워드들의 is_my_store 순위에서 직전 크롤링 대비 변동 계산.
    양수 = 순위 하락(나빠짐), 음수 = 순위 상승(좋아짐).
    """
    for kw in keywords:
        my_rankings = [r for r in (kw.rankings or []) if r.is_my_store]
        if len(my_rankings) < 2:
            continue
        # crawled_at 기준 정렬
        my_rankings.sort(key=lambda r: r.crawled_at, reverse=True)
        latest_time = my_rankings[0].crawled_at
        latest = [r for r in my_rankings if r.crawled_at == latest_time]
        prev = [r for r in my_rankings if r.crawled_at != latest_time]
        if not latest or not prev:
            continue
        prev_time = max(r.crawled_at for r in prev)
        prev_at = [r for r in prev if r.crawled_at == prev_time]
        current_rank = min(r.rank for r in latest)
        prev_rank = min(r.rank for r in prev_at)
        return current_rank - prev_rank  # 양수 = 하락
    return None


async def get_product_list_items(
    db: AsyncSession,
    user_id: int,
    sort_by: str = "urgency",
    category: str | None = None,
    search: str | None = None,
    page: int = 1,
    limit: int = 50,
) -> list[dict]:
    query = (
        select(Product)
        .options(
            selectinload(Product.keywords).selectinload(SearchKeyword.rankings)
        )
        .options(selectinload(Product.cost_items))
        .where(Product.user_id == user_id, Product.is_active == True)
    )
    if category:
        query = query.where(Product.category == category)
    if search:
        query = query.where(Product.name.ilike(f"%{search}%"))

    result = await db.execute(query)
    products = result.scalars().unique().all()

    items = []
    now = datetime.utcnow()
    seven_days_ago = now - timedelta(days=7)

    for product in products:
        active_keywords = [kw for kw in product.keywords if kw.is_active]
        latest_rankings = _get_latest_rankings(active_keywords)

        # 최저가 계산
        if latest_rankings:
            lowest_ranking = min(latest_rankings, key=lambda r: r.price)
            lowest_price = lowest_ranking.price
            lowest_seller = lowest_ranking.mall_name
        else:
            lowest_price = None
            lowest_seller = None

        # 내 순위 (is_my_store=True 중 가장 높은 순위)
        my_rankings = [r for r in latest_rankings if r.is_my_store]
        my_rank = min(r.rank for r in my_rankings) if my_rankings else None

        price_gap = (product.selling_price - lowest_price) if lowest_price else None
        price_gap_pct = round((price_gap / lowest_price) * 100, 1) if price_gap and lowest_price else None

        status = calculate_status(product.selling_price, lowest_price)

        # 마진 계산
        cost_items_data = [
            {"name": ci.name, "type": ci.type, "value": float(ci.value)}
            for ci in product.cost_items
        ]
        margin = calculate_margin(product.selling_price, product.cost_price, cost_items_data)

        # sparkline: 최근 7일 일별 최저가
        sparkline_data = {}
        for kw in active_keywords:
            for r in kw.rankings:
                if r.crawled_at and r.crawled_at >= seven_days_ago:
                    day_key = r.crawled_at.date()
                    if day_key not in sparkline_data or r.price < sparkline_data[day_key]:
                        sparkline_data[day_key] = r.price
        sparkline = [v for _, v in sorted(sparkline_data.items())]

        # last_crawled_at
        last_crawled = None
        for kw in active_keywords:
            if kw.last_crawled_at:
                if last_crawled is None or kw.last_crawled_at > last_crawled:
                    last_crawled = kw.last_crawled_at

        # 이전 크롤링 대비 순위 변동 계산
        rank_change = _calc_rank_change(active_keywords)

        items.append({
            "id": product.id,
            "name": product.name,
            "category": product.category,
            "selling_price": product.selling_price,
            "cost_price": product.cost_price,
            "image_url": product.image_url,
            "is_price_locked": product.is_price_locked,
            "price_lock_reason": product.price_lock_reason,
            "status": status,
            "lowest_price": lowest_price,
            "lowest_seller": lowest_seller,
            "price_gap": price_gap,
            "price_gap_percent": price_gap_pct,
            "my_rank": my_rank,
            "rank_change": rank_change,
            "keyword_count": len(active_keywords),
            "margin_amount": margin["net_margin"],
            "margin_percent": margin["margin_percent"],
            "sparkline": sparkline,
            "last_crawled_at": last_crawled,
        })

    # 정렬
    if sort_by == "urgency":
        items.sort(key=lambda x: (
            STATUS_ORDER.get(x["status"], 3),
            -(x["price_gap"] or 0),
            x["margin_percent"] or 0,
        ))
    elif sort_by == "margin":
        items.sort(key=lambda x: x["margin_percent"] or 0)
    elif sort_by == "rank_drop":
        # rank_change > 0 = 순위 하락 (숫자 높을수록 더 큰 하락)
        items.sort(key=lambda x: -(x["rank_change"] or 0))
    elif sort_by == "category":
        items.sort(key=lambda x: (x["category"] or "", STATUS_ORDER.get(x["status"], 3)))

    # 페이지네이션
    offset = (page - 1) * limit
    return items[offset:offset + limit]


async def get_product_detail(
    db: AsyncSession,
    product_id: int,
) -> dict | None:
    query = (
        select(Product)
        .options(
            selectinload(Product.keywords).selectinload(SearchKeyword.rankings)
        )
        .options(selectinload(Product.cost_items))
        .where(Product.id == product_id)
    )
    result = await db.execute(query)
    product = result.scalars().unique().first()
    if not product:
        return None

    active_keywords = [kw for kw in product.keywords if kw.is_active]
    latest_rankings = _get_latest_rankings(active_keywords)

    # 최저가
    if latest_rankings:
        lowest_ranking = min(latest_rankings, key=lambda r: r.price)
        lowest_price = lowest_ranking.price
        lowest_seller = lowest_ranking.mall_name
    else:
        lowest_price = None
        lowest_seller = None

    # 내 순위
    my_rankings = [r for r in latest_rankings if r.is_my_store]
    my_rank = min(r.rank for r in my_rankings) if my_rankings else None

    price_gap = (product.selling_price - lowest_price) if lowest_price else None
    price_gap_pct = round((price_gap / lowest_price) * 100, 1) if price_gap and lowest_price else None

    status = calculate_status(product.selling_price, lowest_price)

    rank_change = _calc_rank_change(active_keywords)

    # last_crawled_at
    last_crawled = None
    for kw in active_keywords:
        if kw.last_crawled_at:
            if last_crawled is None or kw.last_crawled_at > last_crawled:
                last_crawled = kw.last_crawled_at

    # sparkline: 최근 7일 일별 최저가
    now = datetime.utcnow()
    seven_days_ago = now - timedelta(days=7)
    sparkline_data = {}
    for kw in active_keywords:
        for r in kw.rankings:
            if r.crawled_at and r.crawled_at >= seven_days_ago:
                day_key = r.crawled_at.date()
                if day_key not in sparkline_data or r.price < sparkline_data[day_key]:
                    sparkline_data[day_key] = r.price
    sparkline = [v for _, v in sorted(sparkline_data.items())]

    # 경쟁사 요약 (최신 rankings에서 순위별 요약)
    competitors = []
    seen_malls = set()
    for r in sorted(latest_rankings, key=lambda r: r.rank):
        if r.mall_name in seen_malls:
            continue
        seen_malls.add(r.mall_name)
        competitors.append({
            "rank": r.rank,
            "product_name": r.product_name,
            "price": r.price,
            "mall_name": r.mall_name,
            "is_my_store": r.is_my_store,
        })

    # 키워드별 최신 순위
    keywords_data = []
    for kw in active_keywords:
        if kw.rankings:
            latest_time = max(r.crawled_at for r in kw.rankings)
            kw_latest = sorted(
                [r for r in kw.rankings if r.crawled_at == latest_time],
                key=lambda r: r.rank,
            )
        else:
            kw_latest = []

        keywords_data.append({
            "id": kw.id,
            "keyword": kw.keyword,
            "is_primary": kw.is_primary,
            "crawl_status": kw.crawl_status,
            "last_crawled_at": kw.last_crawled_at,
            "rankings": [
                {
                    "id": r.id,
                    "rank": r.rank,
                    "product_name": r.product_name,
                    "price": r.price,
                    "mall_name": r.mall_name,
                    "product_url": r.product_url,
                    "image_url": r.image_url,
                    "is_my_store": r.is_my_store,
                    "crawled_at": r.crawled_at,
                }
                for r in kw_latest
            ],
        })

    # 마진 계산
    cost_items_data = [
        {"name": ci.name, "type": ci.type, "value": float(ci.value)}
        for ci in product.cost_items
    ]
    margin = calculate_margin(product.selling_price, product.cost_price, cost_items_data)

    return {
        "id": product.id,
        "user_id": product.user_id,
        "name": product.name,
        "category": product.category,
        "selling_price": product.selling_price,
        "cost_price": product.cost_price,
        "image_url": product.image_url,
        "is_price_locked": product.is_price_locked,
        "price_lock_reason": product.price_lock_reason,
        "status": status,
        "lowest_price": lowest_price,
        "lowest_seller": lowest_seller,
        "price_gap": price_gap,
        "price_gap_percent": price_gap_pct,
        "my_rank": my_rank,
        "rank_change": rank_change,
        "keyword_count": len(active_keywords),
        "last_crawled_at": last_crawled,
        "sparkline": sparkline,
        "competitors": competitors,
        "keywords": keywords_data,
        "margin": margin,
    }
