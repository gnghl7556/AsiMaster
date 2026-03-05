from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.schemas.included_override import IncludedOverrideRequest, IncludedOverrideResponse
from app.services import included_override_service

router = APIRouter(tags=["included-overrides"])


@router.get("/products/{product_id}/included", response_model=list[IncludedOverrideResponse])
async def get_included_overrides(product_id: int, db: AsyncSession = Depends(get_db)):
    """수동 포함 예외 목록 조회."""
    return await included_override_service.get_included_overrides(db, product_id)


@router.post("/products/{product_id}/included", response_model=IncludedOverrideResponse, status_code=201)
async def add_included_override(
    product_id: int,
    data: IncludedOverrideRequest,
    db: AsyncSession = Depends(get_db),
):
    """수동 포함 예외 추가 + 기존 최신 rankings 즉시 is_relevant=True 반영."""
    return await included_override_service.add_included_override(
        db, product_id, data.naver_product_id, data.naver_product_name, data.mall_name,
    )


@router.delete("/products/{product_id}/included/{naver_product_id}", status_code=204)
async def remove_included_override(
    product_id: int,
    naver_product_id: str,
    db: AsyncSession = Depends(get_db),
):
    """수동 포함 예외 해제. 기존 rankings는 다음 크롤링에서 재판정."""
    await included_override_service.remove_included_override(db, product_id, naver_product_id)
