from datetime import datetime

from pydantic import BaseModel, Field


class ShippingOverrideRequest(BaseModel):
    naver_product_id: str = Field(..., min_length=1, max_length=50)
    shipping_fee: int = Field(..., ge=0, le=100000)
    naver_product_name: str | None = None
    mall_name: str | None = None


class ShippingOverrideUpdateRequest(BaseModel):
    shipping_fee: int = Field(..., ge=0, le=100000)


class ShippingOverrideResponse(BaseModel):
    id: int
    naver_product_id: str
    shipping_fee: int
    naver_product_name: str | None
    mall_name: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
