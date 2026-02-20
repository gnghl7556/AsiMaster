from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_db
from app.models.keyword_ranking import KeywordRanking
from app.models.search_keyword import SearchKeyword

router = APIRouter(tags=["prices"])

PERIOD_DAYS = {"1d": 1, "7d": 7, "30d": 30}


@router.get("/products/{product_id}/price-history")
async def get_price_history(
    product_id: int,
    period: str = Query("7d", pattern="^(1d|7d|30d)$"),
    keyword_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    days = PERIOD_DAYS[period]
    since = datetime.utcnow() - timedelta(days=days)

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


@router.get("/products/{product_id}/price-snapshot")
async def get_price_snapshot(product_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SearchKeyword)
        .options(selectinload(SearchKeyword.rankings))
        .where(
            SearchKeyword.product_id == product_id,
            SearchKeyword.is_active == True,
        )
    )
    keywords = result.scalars().unique().all()

    snapshot = []
    for kw in keywords:
        if not kw.rankings:
            continue
        latest_time = max(r.crawled_at for r in kw.rankings)
        latest = [r for r in kw.rankings if r.crawled_at == latest_time]
        for r in sorted(latest, key=lambda x: x.rank):
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
