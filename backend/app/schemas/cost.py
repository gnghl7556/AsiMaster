from datetime import datetime

from pydantic import BaseModel, Field


class CostItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: str = Field(..., pattern="^(percent|fixed)$")
    value: float = Field(..., ge=0)
    sort_order: int = 0


class CostItemResponse(BaseModel):
    id: int
    product_id: int
    name: str
    type: str
    value: float
    sort_order: int
    created_at: datetime

    model_config = {"from_attributes": True}


class CostPresetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    items: list[CostItemCreate]


class CostPresetResponse(BaseModel):
    id: int
    user_id: int
    name: str
    items: list[dict]
    created_at: datetime

    model_config = {"from_attributes": True}


class MarginResult(BaseModel):
    selling_price: int
    cost_price: int
    total_costs: int
    cost_items: list[dict]
    net_margin: int
    margin_percent: float


class MarginSimulateRequest(BaseModel):
    selling_price: int = Field(..., ge=0)
