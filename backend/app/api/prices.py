from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.schemas.price import PriceHistoryItem, PriceSnapshotItem
from app.services.price_service import get_price_history, get_price_snapshot

router = APIRouter(tags=["prices"])


@router.get("/products/{product_id}/price-history", response_model=list[PriceHistoryItem])
async def price_history(
    product_id: int,
    period: str = Query("7d", pattern="^(1d|7d|30d)$"),
    keyword_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    return await get_price_history(db, product_id, period, keyword_id)


@router.get("/products/{product_id}/price-snapshot", response_model=list[PriceSnapshotItem])
async def price_snapshot(product_id: int, db: AsyncSession = Depends(get_db)):
    return await get_price_snapshot(db, product_id)
