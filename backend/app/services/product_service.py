from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.excluded_product import ExcludedProduct
from app.models.product import Product
from app.models.search_keyword import SearchKeyword
from app.core.utils import utcnow


def calculate_status(selling_price: int, lowest_price: int | None) -> str:
    if lowest_price is None:
        return "winning"
    if lowest_price == 0:
        return "losing"
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


def _filter_relevant(rankings: list, excluded_ids: set[str], excluded_malls: set[str]) -> list:
    """is_relevant=True + 블랙리스트 제외 필터."""
    return [
        r for r in rankings
        if r.is_relevant
        and r.naver_product_id not in excluded_ids
        and (r.mall_name or "").strip().lower() not in excluded_malls
    ]


def _find_lowest(relevant_rankings: list) -> tuple[int | None, str | None]:
    """최저가 + 판매자 반환."""
    if not relevant_rankings:
        return None, None
    lowest = min(relevant_rankings, key=lambda r: r.price)
    return lowest.price, lowest.mall_name


def _build_sparkline(
    keywords: list, since, excluded_ids: set[str], excluded_malls: set[str],
) -> list[int]:
    """최근 N일 일별 최저가 sparkline."""
    data: dict = {}
    for kw in keywords:
        for r in kw.rankings:
            if (r.crawled_at and r.crawled_at >= since
                    and r.is_relevant
                    and r.naver_product_id not in excluded_ids
                    and (r.mall_name or "").strip().lower() not in excluded_malls):
                day_key = r.crawled_at.date()
                if day_key not in data or r.price < data[day_key]:
                    data[day_key] = r.price
    return [v for _, v in sorted(data.items())]


def _calc_price_gap(selling_price: int, lowest_price: int | None) -> tuple[int | None, float | None]:
    """가격 차이 + 퍼센트 반환 (ZeroDivision 방어)."""
    if not lowest_price:
        return None, None
    gap = selling_price - lowest_price
    pct = round((gap / lowest_price) * 100, 1) if lowest_price > 0 else None
    return gap, pct


def _is_my_exact_product(ranking, product_naver_id: str | None) -> bool:
    """이 ranking이 정확히 내 상품인지 판별.
    naver_product_id가 설정되어 있으면 정확히 매칭, 없으면 is_my_store로 fallback.
    """
    if product_naver_id:
        return ranking.naver_product_id == product_naver_id
    return ranking.is_my_store


def _calc_rank_change(keywords: list, product_naver_id: str | None = None) -> int | None:
    """키워드들의 내 상품 순위에서 직전 크롤링 대비 변동 계산.
    양수 = 순위 하락(나빠짐), 음수 = 순위 상승(좋아짐).
    """
    for kw in keywords:
        my_rankings = [
            r for r in (kw.rankings or [])
            if _is_my_exact_product(r, product_naver_id)
        ]
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


def _calc_my_rank(latest_rankings: list, product_naver_id: str | None) -> int | None:
    """최신 rankings에서 내 상품 순위 추출."""
    my_rankings = [
        r for r in latest_rankings
        if _is_my_exact_product(r, product_naver_id)
    ]
    return min(r.rank for r in my_rankings) if my_rankings else None


def _calc_last_crawled(active_keywords: list):
    """활성 키워드 중 가장 최근 크롤링 시각."""
    last_crawled = None
    for kw in active_keywords:
        if kw.last_crawled_at:
            if last_crawled is None or kw.last_crawled_at > last_crawled:
                last_crawled = kw.last_crawled_at
    return last_crawled


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
        escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        query = query.where(Product.name.ilike(f"%{escaped}%"))

    result = await db.execute(query)
    products = result.scalars().unique().all()

    # 상품별 블랙리스트 조회 (naver_product_id + mall_name 이중 체크)
    product_ids = [p.id for p in products]
    excluded_ids_by_product: dict[int, set[str]] = {pid: set() for pid in product_ids}
    excluded_malls_by_product: dict[int, set[str]] = {pid: set() for pid in product_ids}
    if product_ids:
        ex_result = await db.execute(
            select(ExcludedProduct).where(ExcludedProduct.product_id.in_(product_ids))
        )
        for ep in ex_result.scalars().all():
            excluded_ids_by_product[ep.product_id].add(ep.naver_product_id)
            if ep.mall_name:
                excluded_malls_by_product[ep.product_id].add(ep.mall_name.strip().lower())

    items = []
    now = utcnow()
    seven_days_ago = now - timedelta(days=7)

    for product in products:
        active_keywords = [kw for kw in product.keywords if kw.is_active]
        latest_rankings = _get_latest_rankings(active_keywords)
        excluded_ids = excluded_ids_by_product.get(product.id, set())
        excluded_malls = excluded_malls_by_product.get(product.id, set())

        relevant_rankings = _filter_relevant(latest_rankings, excluded_ids, excluded_malls)
        lowest_price, lowest_seller = _find_lowest(relevant_rankings)

        product_naver_id = product.naver_product_id
        my_rank = _calc_my_rank(latest_rankings, product_naver_id)

        price_gap, price_gap_pct = _calc_price_gap(product.selling_price, lowest_price)
        status = calculate_status(product.selling_price, lowest_price)

        cost_items_data = [
            {"name": ci.name, "type": ci.type, "value": float(ci.value)}
            for ci in product.cost_items
        ]
        margin = calculate_margin(product.selling_price, product.cost_price, cost_items_data)

        sparkline = _build_sparkline(active_keywords, seven_days_ago, excluded_ids, excluded_malls)
        last_crawled = _calc_last_crawled(active_keywords)
        rank_change = _calc_rank_change(active_keywords, product_naver_id)

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

    # 블랙리스트 조회 (naver_product_id + mall_name 이중 체크)
    ex_result = await db.execute(
        select(ExcludedProduct).where(ExcludedProduct.product_id == product_id)
    )
    excluded_rows = ex_result.scalars().all()
    excluded_ids = {ep.naver_product_id for ep in excluded_rows}
    excluded_malls = {ep.mall_name.strip().lower() for ep in excluded_rows if ep.mall_name}

    relevant_rankings = _filter_relevant(latest_rankings, excluded_ids, excluded_malls)
    lowest_price, lowest_seller = _find_lowest(relevant_rankings)

    product_naver_id = product.naver_product_id
    my_rank = _calc_my_rank(latest_rankings, product_naver_id)

    price_gap, price_gap_pct = _calc_price_gap(product.selling_price, lowest_price)
    status = calculate_status(product.selling_price, lowest_price)

    rank_change = _calc_rank_change(active_keywords, product_naver_id)
    last_crawled = _calc_last_crawled(active_keywords)

    seven_days_ago = utcnow() - timedelta(days=7)
    sparkline = _build_sparkline(active_keywords, seven_days_ago, excluded_ids, excluded_malls)

    # 경쟁사 요약 (최신 rankings에서 순위별 요약, 블랙리스트 제외)
    competitors = []
    seen_malls = set()
    for r in sorted(latest_rankings, key=lambda r: r.rank):
        if r.naver_product_id and r.naver_product_id in excluded_ids:
            continue
        if (r.mall_name or "").strip().lower() in excluded_malls:
            continue
        if r.mall_name in seen_malls:
            continue
        seen_malls.add(r.mall_name)
        competitors.append({
            "rank": r.rank,
            "product_name": r.product_name,
            "price": r.price,
            "mall_name": r.mall_name,
            "is_my_store": r.is_my_store,
            "naver_product_id": r.naver_product_id,
            "is_relevant": r.is_relevant,
            "hprice": r.hprice or 0,
            "brand": r.brand,
            "maker": r.maker,
        })

    # 키워드별 최신 순위
    keywords_data = []
    for kw in active_keywords:
        if kw.rankings:
            latest_time = max(r.crawled_at for r in kw.rankings)
            kw_latest = sorted(
                [r for r in kw.rankings
                 if r.crawled_at == latest_time
                 and not (r.naver_product_id and r.naver_product_id in excluded_ids)
                 and (r.mall_name or "").strip().lower() not in excluded_malls],
                key=lambda r: r.rank,
            )
        else:
            kw_latest = []

        keywords_data.append({
            "id": kw.id,
            "keyword": kw.keyword,
            "sort_type": kw.sort_type or "sim",
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
                    "naver_product_id": r.naver_product_id,
                    "is_my_store": r.is_my_store,
                    "is_relevant": r.is_relevant,
                    "hprice": r.hprice or 0,
                    "brand": r.brand,
                    "maker": r.maker,
                    "product_type": r.product_type,
                    "category1": r.category1,
                    "category2": r.category2,
                    "category3": r.category3,
                    "category4": r.category4,
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
        "naver_product_id": product.naver_product_id,
        "model_code": product.model_code,
        "spec_keywords": product.spec_keywords,
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
