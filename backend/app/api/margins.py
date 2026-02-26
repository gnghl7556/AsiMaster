from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.schemas.cost import MarginResult, MarginSimulateRequest
from app.services.margin_service import get_margin, simulate_margin

router = APIRouter(tags=["margins"])


@router.get("/products/{product_id}/margin", response_model=MarginResult)
async def get_product_margin(product_id: int, db: AsyncSession = Depends(get_db)):
    result = await get_margin(db, product_id)
    if result is None:
        raise HTTPException(404, "상품을 찾을 수 없습니다.")
    return result


@router.post("/products/{product_id}/margin/simulate", response_model=MarginResult)
async def simulate_product_margin(
    product_id: int, data: MarginSimulateRequest, db: AsyncSession = Depends(get_db)
):
    result = await simulate_margin(db, product_id, data.selling_price)
    if result is None:
        raise HTTPException(404, "상품을 찾을 수 없습니다.")
    return result
