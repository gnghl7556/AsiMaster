from datetime import datetime

from pydantic import BaseModel, Field


class IncludedOverrideRequest(BaseModel):
    naver_product_id: str = Field(..., min_length=1)
    naver_product_name: str | None = None
    mall_name: str | None = None


class IncludedOverrideResponse(BaseModel):
    id: int
    naver_product_id: str
    naver_product_name: str | None
    mall_name: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
