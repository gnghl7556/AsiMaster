from datetime import timedelta

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.excluded_product import ExcludedProduct
from app.models.keyword_ranking import KeywordRanking
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
    """배송비 포함 최저 총액 + 판매자 반환."""
    if not relevant_rankings:
        return None, None
    lowest = min(relevant_rankings, key=lambda r: r.price + (r.shipping_fee or 0))
    return lowest.price + (lowest.shipping_fee or 0), lowest.mall_name


def _calc_price_gap(selling_price: int, lowest_price: int | None) -> tuple[int | None, float | None]:
    """가격 차이 + 퍼센트 반환."""
    if not lowest_price:
        return None, None
    gap = selling_price - lowest_price
    pct = round((gap / lowest_price) * 100, 1) if lowest_price > 0 else None
    return gap, pct


def _is_my_exact_product(ranking, product_naver_id: str | None) -> bool:
    if product_naver_id:
        return ranking.naver_product_id == product_naver_id
    return ranking.is_my_store


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


# ---------------------------------------------------------------------------
# DB 쿼리 기반 헬퍼 (메모리 최적화)
# ---------------------------------------------------------------------------

async def _fetch_latest_rankings(
    db: AsyncSession, keyword_ids: list[int],
) -> dict[int, list[KeywordRanking]]:
    """키워드별 최신 crawled_at의 rankings만 DB에서 조회."""
    if not keyword_ids:
        return {}

    # 서브쿼리: 키워드별 MAX(crawled_at)
    latest_sub = (
        select(
            KeywordRanking.keyword_id,
            func.max(KeywordRanking.crawled_at).label("max_at"),
        )
        .where(KeywordRanking.keyword_id.in_(keyword_ids))
        .group_by(KeywordRanking.keyword_id)
    ).subquery()

    result = await db.execute(
        select(KeywordRanking)
        .join(latest_sub, and_(
            KeywordRanking.keyword_id == latest_sub.c.keyword_id,
            KeywordRanking.crawled_at == latest_sub.c.max_at,
        ))
    )
    rows = result.scalars().all()

    grouped: dict[int, list[KeywordRanking]] = {}
    for r in rows:
        grouped.setdefault(r.keyword_id, []).append(r)
    return grouped


async def _fetch_sparkline_data(
    db: AsyncSession,
    keyword_ids: list[int],
    since,
    excluded_ids: set[str],
    excluded_malls: set[str],
) -> list[int]:
    """7일 일별 최저가 sparkline을 DB 집계로 생성."""
    if not keyword_ids:
        return []

    query = (
        select(
            func.date(KeywordRanking.crawled_at).label("day"),
            func.min(KeywordRanking.price + func.coalesce(KeywordRanking.shipping_fee, 0)).label("min_price"),
        )
        .where(
            KeywordRanking.keyword_id.in_(keyword_ids),
            KeywordRanking.crawled_at >= since,
            KeywordRanking.is_relevant == True,
        )
    )

    # 블랙리스트 naver_product_id 제외
    if excluded_ids:
        query = query.where(
            ~KeywordRanking.naver_product_id.in_(excluded_ids)
            | KeywordRanking.naver_product_id.is_(None)
        )

    # 블랙리스트 mall_name 제외
    if excluded_malls:
        for mall in excluded_malls:
            query = query.where(
                func.lower(func.trim(KeywordRanking.mall_name)) != mall
            )

    query = query.group_by(func.date(KeywordRanking.crawled_at))
    result = await db.execute(query)
    rows = result.all()

    return [row.min_price for row in sorted(rows, key=lambda r: r.day)]


async def _fetch_rank_change(
    db: AsyncSession,
    keyword_ids: list[int],
    product_naver_id: str | None,
) -> int | None:
    """내 상품의 최근 2회 크롤링 순위 변동 계산."""
    if not keyword_ids:
        return None

    # 내 상품 rankings만 조회
    query = (
        select(
            KeywordRanking.keyword_id,
            KeywordRanking.rank,
            KeywordRanking.crawled_at,
        )
        .where(KeywordRanking.keyword_id.in_(keyword_ids))
    )

    if product_naver_id:
        query = query.where(KeywordRanking.naver_product_id == product_naver_id)
    else:
        query = query.where(KeywordRanking.is_my_store == True)

    query = query.order_by(KeywordRanking.crawled_at.desc())
    result = await db.execute(query)
    rows = result.all()

    if not rows:
        return None

    # 키워드별로 그룹핑해서 첫 번째 키워드의 변동 반환
    by_keyword: dict[int, list] = {}
    for r in rows:
        by_keyword.setdefault(r.keyword_id, []).append(r)

    for kw_id, kw_rows in by_keyword.items():
        if len(kw_rows) < 2:
            continue
        latest_time = kw_rows[0].crawled_at
        latest = [r for r in kw_rows if r.crawled_at == latest_time]
        prev = [r for r in kw_rows if r.crawled_at != latest_time]
        if not latest or not prev:
            continue
        prev_time = max(r.crawled_at for r in prev)
        prev_at = [r for r in prev if r.crawled_at == prev_time]
        current_rank = min(r.rank for r in latest)
        prev_rank = min(r.rank for r in prev_at)
        return current_rank - prev_rank

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
    # rankings 없이 keywords + cost_items만 eager load
    query = (
        select(Product)
        .options(selectinload(Product.keywords))
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

    if not products:
        return []

    # 전체 키워드 ID 수집
    all_keyword_ids: list[int] = []
    product_keyword_map: dict[int, list[int]] = {}
    product_active_keywords: dict[int, list] = {}
    for p in products:
        active = [kw for kw in p.keywords if kw.is_active]
        product_active_keywords[p.id] = active
        kw_ids = [kw.id for kw in active]
        product_keyword_map[p.id] = kw_ids
        all_keyword_ids.extend(kw_ids)

    # 상품별 블랙리스트 조회
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

    # DB 쿼리: 최신 rankings (전체 키워드 한 번에)
    all_latest = await _fetch_latest_rankings(db, all_keyword_ids)

    now = utcnow()
    seven_days_ago = now - timedelta(days=7)

    items = []
    for product in products:
        active_keywords = product_active_keywords[product.id]
        kw_ids = product_keyword_map[product.id]
        excluded_ids = excluded_ids_by_product.get(product.id, set())
        excluded_malls = excluded_malls_by_product.get(product.id, set())

        # 키워드별 최신 rankings 합치기
        latest_rankings = []
        for kid in kw_ids:
            latest_rankings.extend(all_latest.get(kid, []))

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

        # sparkline과 rank_change는 키워드별 별도 쿼리
        sparkline = await _fetch_sparkline_data(
            db, kw_ids, seven_days_ago, excluded_ids, excluded_malls,
        )
        last_crawled = _calc_last_crawled(active_keywords)
        rank_change = await _fetch_rank_change(db, kw_ids, product_naver_id)

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
    # rankings 없이 keywords + cost_items만 eager load
    query = (
        select(Product)
        .options(selectinload(Product.keywords))
        .options(selectinload(Product.cost_items))
        .where(Product.id == product_id)
    )
    result = await db.execute(query)
    product = result.scalars().unique().first()
    if not product:
        return None

    active_keywords = [kw for kw in product.keywords if kw.is_active]
    kw_ids = [kw.id for kw in active_keywords]

    # 블랙리스트 조회
    ex_result = await db.execute(
        select(ExcludedProduct).where(ExcludedProduct.product_id == product_id)
    )
    excluded_rows = ex_result.scalars().all()
    excluded_ids = {ep.naver_product_id for ep in excluded_rows}
    excluded_malls = {ep.mall_name.strip().lower() for ep in excluded_rows if ep.mall_name}

    # DB 쿼리: 최신 rankings
    latest_by_kw = await _fetch_latest_rankings(db, kw_ids)

    # 전체 최신 rankings 합치기
    latest_rankings = []
    for kid in kw_ids:
        latest_rankings.extend(latest_by_kw.get(kid, []))

    relevant_rankings = _filter_relevant(latest_rankings, excluded_ids, excluded_malls)
    lowest_price, lowest_seller = _find_lowest(relevant_rankings)

    product_naver_id = product.naver_product_id
    my_rank = _calc_my_rank(latest_rankings, product_naver_id)

    price_gap, price_gap_pct = _calc_price_gap(product.selling_price, lowest_price)
    status = calculate_status(product.selling_price, lowest_price)

    rank_change = await _fetch_rank_change(db, kw_ids, product_naver_id)
    last_crawled = _calc_last_crawled(active_keywords)

    seven_days_ago = utcnow() - timedelta(days=7)
    sparkline = await _fetch_sparkline_data(
        db, kw_ids, seven_days_ago, excluded_ids, excluded_malls,
    )

    # 경쟁사 요약 (블랙리스트 제외)
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
            "shipping_fee": r.shipping_fee or 0,
        })

    # 키워드별 최신 순위
    keywords_data = []
    for kw in active_keywords:
        kw_rankings = latest_by_kw.get(kw.id, [])
        kw_latest = sorted(
            [r for r in kw_rankings
             if not (r.naver_product_id and r.naver_product_id in excluded_ids)
             and (r.mall_name or "").strip().lower() not in excluded_malls],
            key=lambda r: r.rank,
        )

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
                    "shipping_fee": r.shipping_fee or 0,
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
