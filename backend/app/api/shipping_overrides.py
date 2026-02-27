from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.schemas.shipping_override import (
    ShippingOverrideRequest,
    ShippingOverrideResponse,
    ShippingOverrideUpdateRequest,
)
from app.services import shipping_override_service

router = APIRouter(tags=["shipping-overrides"])


@router.get(
    "/products/{product_id}/shipping-overrides",
    response_model=list[ShippingOverrideResponse],
)
async def get_shipping_overrides(
    product_id: int, db: AsyncSession = Depends(get_db)
):
    return await shipping_override_service.get_shipping_overrides(db, product_id)


@router.post(
    "/products/{product_id}/shipping-overrides",
    response_model=ShippingOverrideResponse,
    status_code=201,
)
async def add_shipping_override(
    product_id: int,
    data: ShippingOverrideRequest,
    db: AsyncSession = Depends(get_db),
):
    return await shipping_override_service.add_shipping_override(
        db,
        product_id,
        data.naver_product_id,
        data.shipping_fee,
        data.naver_product_name,
        data.mall_name,
    )


@router.patch(
    "/products/{product_id}/shipping-overrides/{naver_product_id}",
    response_model=ShippingOverrideResponse,
)
async def update_shipping_override(
    product_id: int,
    naver_product_id: str,
    data: ShippingOverrideUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    return await shipping_override_service.update_shipping_override(
        db, product_id, naver_product_id, data.shipping_fee
    )


@router.delete(
    "/products/{product_id}/shipping-overrides/{naver_product_id}",
    status_code=204,
)
async def remove_shipping_override(
    product_id: int,
    naver_product_id: str,
    db: AsyncSession = Depends(get_db),
):
    await shipping_override_service.remove_shipping_override(
        db, product_id, naver_product_id
    )
