from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.search_keyword import KeywordWithRankings


class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    category: str | None = None
    cost_price: int = Field(..., ge=0)
    selling_price: int = Field(..., ge=0)
    image_url: str | None = None


class ProductUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    category: str | None = None
    cost_price: int | None = Field(None, ge=0)
    selling_price: int | None = Field(None, ge=0)
    image_url: str | None = None


class PriceLockUpdate(BaseModel):
    is_locked: bool
    reason: str | None = None


class ProductResponse(BaseModel):
    id: int
    user_id: int
    name: str
    category: str | None
    cost_price: int
    selling_price: int
    image_url: str | None
    is_price_locked: bool
    price_lock_reason: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProductListItem(BaseModel):
    id: int
    name: str
    category: str | None
    selling_price: int
    cost_price: int
    image_url: str | None
    is_price_locked: bool
    price_lock_reason: str | None
    status: str  # winning | close | losing
    lowest_price: int | None
    lowest_seller: str | None
    price_gap: int | None
    price_gap_percent: float | None
    my_rank: int | None
    rank_change: int | None
    keyword_count: int
    margin_amount: int | None
    margin_percent: float | None
    sparkline: list[int]
    last_crawled_at: datetime | None


class MarginDetail(BaseModel):
    selling_price: int
    cost_price: int
    total_costs: int
    cost_items: list[dict]
    net_margin: int
    margin_percent: float


class CompetitorSummary(BaseModel):
    rank: int
    product_name: str
    price: int
    mall_name: str
    is_my_store: bool


class ProductDetail(BaseModel):
    id: int
    user_id: int
    name: str
    category: str | None
    selling_price: int
    cost_price: int
    image_url: str | None
    is_price_locked: bool
    price_lock_reason: str | None
    status: str
    lowest_price: int | None
    lowest_seller: str | None
    price_gap: int | None
    price_gap_percent: float | None
    my_rank: int | None
    rank_change: int | None
    keyword_count: int
    last_crawled_at: datetime | None
    sparkline: list[int]
    competitors: list[CompetitorSummary]
    keywords: list[KeywordWithRankings]
    margin: MarginDetail | None
