from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func, case, literal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.competitor import Competitor
from app.models.cost import CostItem
from app.models.platform import Platform
from app.models.price_history import PriceHistory
from app.models.product import Product


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


STATUS_ORDER = {"losing": 0, "close": 1, "winning": 2}


async def get_product_list_items(
    db: AsyncSession,
    user_id: int,
    sort_by: str = "urgency",
    category: str | None = None,
    search: str | None = None,
) -> list[dict]:
    query = (
        select(Product)
        .options(selectinload(Product.competitors).selectinload(Competitor.platform))
        .options(selectinload(Product.competitors).selectinload(Competitor.price_history))
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
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)

    for product in products:
        # 각 경쟁사의 최신 가격 수집
        latest_prices = []
        all_sparkline_data = {}
        last_crawled = None

        for comp in product.competitors:
            if not comp.is_active:
                continue

            sorted_history = sorted(comp.price_history, key=lambda h: h.crawled_at, reverse=True)
            if sorted_history:
                latest = sorted_history[0]
                latest_prices.append({
                    "platform": comp.platform.display_name,
                    "total_price": latest.total_price,
                    "shipping_fee": latest.shipping_fee,
                    "ranking": latest.ranking,
                    "total_sellers": latest.total_sellers,
                    "crawled_at": latest.crawled_at,
                })
                if last_crawled is None or latest.crawled_at > last_crawled:
                    last_crawled = latest.crawled_at

            # sparkline: 최근 7일간 일별 최저가
            for h in sorted_history:
                if h.crawled_at and h.crawled_at >= seven_days_ago:
                    day_key = h.crawled_at.date()
                    if day_key not in all_sparkline_data or h.total_price < all_sparkline_data[day_key]:
                        all_sparkline_data[day_key] = h.total_price

        # 최저가 계산
        lowest = min(latest_prices, key=lambda x: x["total_price"]) if latest_prices else None

        lowest_price = lowest["total_price"] if lowest else None
        lowest_platform = lowest["platform"] if lowest else None
        lowest_shipping = lowest["shipping_fee"] if lowest else None

        price_gap = (product.selling_price - lowest_price) if lowest_price else None
        price_gap_pct = round((price_gap / lowest_price) * 100, 1) if price_gap and lowest_price else None

        status = calculate_status(product.selling_price, lowest_price)

        # 마진 계산
        cost_items_data = [
            {"name": ci.name, "type": ci.type, "value": float(ci.value)}
            for ci in product.cost_items
        ]
        margin = calculate_margin(product.selling_price, product.cost_price, cost_items_data)

        # sparkline 정렬
        sparkline = [v for _, v in sorted(all_sparkline_data.items())]

        # ranking
        ranking = lowest["ranking"] if lowest else None
        total_sellers = lowest["total_sellers"] if lowest else None

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
            "lowest_platform": lowest_platform,
            "lowest_shipping_fee": lowest_shipping,
            "price_gap": price_gap,
            "price_gap_percent": price_gap_pct,
            "ranking": ranking,
            "total_sellers": total_sellers,
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
        items.sort(key=lambda x: -(x["ranking"] or 0))
    elif sort_by == "category":
        items.sort(key=lambda x: (x["category"] or "", STATUS_ORDER.get(x["status"], 3)))

    return items
