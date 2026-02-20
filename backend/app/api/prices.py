from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_db
from app.models.competitor import Competitor
from app.models.price_history import PriceHistory

router = APIRouter(tags=["prices"])


PERIOD_DAYS = {"1d": 1, "7d": 7, "30d": 30}


@router.get("/products/{product_id}/price-history")
async def get_price_history(
    product_id: int,
    period: str = Query("7d", pattern="^(1d|7d|30d)$"),
    platform_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    days = PERIOD_DAYS[period]
    since = datetime.utcnow() - timedelta(days=days)

    query = (
        select(PriceHistory)
        .join(Competitor)
        .where(
            Competitor.product_id == product_id,
            Competitor.is_active == True,
            PriceHistory.crawled_at >= since,
        )
    )
    if platform_id:
        query = query.where(Competitor.platform_id == platform_id)

    query = query.order_by(PriceHistory.crawled_at)
    result = await db.execute(query)
    history = result.scalars().all()

    return [
        {
            "competitor_id": h.competitor_id,
            "price": h.price,
            "shipping_fee": h.shipping_fee,
            "total_price": h.total_price,
            "ranking": h.ranking,
            "crawled_at": h.crawled_at,
        }
        for h in history
    ]


@router.get("/products/{product_id}/price-snapshot")
async def get_price_snapshot(product_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Competitor)
        .options(selectinload(Competitor.platform))
        .options(selectinload(Competitor.price_history))
        .where(Competitor.product_id == product_id, Competitor.is_active == True)
    )
    competitors = result.scalars().unique().all()

    snapshot = []
    for comp in competitors:
        sorted_history = sorted(comp.price_history, key=lambda h: h.crawled_at, reverse=True)
        latest = sorted_history[0] if sorted_history else None
        snapshot.append({
            "competitor_id": comp.id,
            "platform": comp.platform.display_name,
            "seller_name": comp.seller_name,
            "url": comp.url,
            "price": latest.price if latest else None,
            "shipping_fee": latest.shipping_fee if latest else None,
            "total_price": latest.total_price if latest else None,
            "ranking": latest.ranking if latest else None,
            "crawled_at": latest.crawled_at if latest else None,
        })

    snapshot.sort(key=lambda x: x["total_price"] or float("inf"))
    return snapshot
