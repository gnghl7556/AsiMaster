from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.models.competitor import Competitor
from app.models.product import Product
from app.schemas.competitor import CompetitorCreate, CompetitorResponse, CompetitorUpdate

router = APIRouter(tags=["competitors"])


@router.get("/products/{product_id}/competitors", response_model=list[CompetitorResponse])
async def get_competitors(product_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Competitor).where(Competitor.product_id == product_id).order_by(Competitor.created_at)
    )
    return result.scalars().all()


@router.post("/products/{product_id}/competitors", response_model=CompetitorResponse, status_code=201)
async def create_competitor(
    product_id: int, data: CompetitorCreate, db: AsyncSession = Depends(get_db)
):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "상품을 찾을 수 없습니다.")
    competitor = Competitor(product_id=product_id, platform_id=data.platform_id, url=data.url)
    db.add(competitor)
    await db.flush()
    await db.refresh(competitor)
    return competitor


@router.put("/competitors/{competitor_id}", response_model=CompetitorResponse)
async def update_competitor(
    competitor_id: int, data: CompetitorUpdate, db: AsyncSession = Depends(get_db)
):
    competitor = await db.get(Competitor, competitor_id)
    if not competitor:
        raise HTTPException(404, "경쟁사를 찾을 수 없습니다.")
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(competitor, field, value)
    await db.flush()
    await db.refresh(competitor)
    return competitor


@router.delete("/competitors/{competitor_id}", status_code=204)
async def delete_competitor(competitor_id: int, db: AsyncSession = Depends(get_db)):
    competitor = await db.get(Competitor, competitor_id)
    if not competitor:
        raise HTTPException(404, "경쟁사를 찾을 수 없습니다.")
    await db.delete(competitor)
