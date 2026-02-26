from datetime import timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.core.utils import utcnow
from app.models.keyword_ranking import KeywordRanking
from app.models.search_keyword import SearchKeyword
from app.schemas.price import PriceHistoryItem, PriceSnapshotItem
from app.services.product_service import _fetch_latest_rankings

router = APIRouter(tags=["prices"])

PERIOD_DAYS = {"1d": 1, "7d": 7, "30d": 30}


@router.get("/products/{product_id}/price-history", response_model=list[PriceHistoryItem])
async def get_price_history(
    product_id: int,
    period: str = Query("7d", pattern="^(1d|7d|30d)$"),
    keyword_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    days = PERIOD_DAYS[period]
    since = utcnow() - timedelta(days=days)

    query = (
        select(KeywordRanking)
        .join(SearchKeyword)
        .where(
            SearchKeyword.product_id == product_id,
            SearchKeyword.is_active == True,
            KeywordRanking.crawled_at >= since,
        )
    )
    if keyword_id:
        query = query.where(SearchKeyword.id == keyword_id)

    query = query.order_by(KeywordRanking.crawled_at)
    result = await db.execute(query)
    rankings = result.scalars().all()

    return [
        {
            "keyword_id": r.keyword_id,
            "rank": r.rank,
            "product_name": r.product_name,
            "price": r.price,
            "mall_name": r.mall_name,
            "is_my_store": r.is_my_store,
            "crawled_at": r.crawled_at,
        }
        for r in rankings
    ]


@router.get("/products/{product_id}/price-snapshot", response_model=list[PriceSnapshotItem])
async def get_price_snapshot(product_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SearchKeyword).where(
            SearchKeyword.product_id == product_id,
            SearchKeyword.is_active == True,
        )
    )
    keywords = result.scalars().all()
    if not keywords:
        return []

    kw_ids = [kw.id for kw in keywords]
    kw_map = {kw.id: kw for kw in keywords}

    latest_by_kw = await _fetch_latest_rankings(db, kw_ids)

    snapshot = []
    for kw_id, rankings in latest_by_kw.items():
        kw = kw_map.get(kw_id)
        if not kw:
            continue
        for r in sorted(rankings, key=lambda x: x.rank):
            snapshot.append({
                "keyword_id": kw.id,
                "keyword": kw.keyword,
                "rank": r.rank,
                "product_name": r.product_name,
                "price": r.price,
                "mall_name": r.mall_name,
                "is_my_store": r.is_my_store,
                "crawled_at": r.crawled_at,
            })

    return snapshot
