from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.search_keyword import KeywordWithRankings


class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    category: str | None = None
    cost_price: int = Field(..., ge=0)
    selling_price: int = Field(..., ge=0)
    image_url: str | None = None
    naver_product_id: str | None = Field(None, max_length=50)
    model_code: str | None = Field(None, max_length=100)
    spec_keywords: list[str] | None = None
    price_filter_min_pct: int | None = Field(None, ge=0, le=100)
    price_filter_max_pct: int | None = Field(None, ge=100)
    # 제품 속성
    brand: str | None = Field(None, max_length=100)
    maker: str | None = Field(None, max_length=100)
    series: str | None = Field(None, max_length=100)
    capacity: str | None = Field(None, max_length=50)
    color: str | None = Field(None, max_length=50)
    material: str | None = Field(None, max_length=50)
    product_attributes: dict | None = None


class ProductUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    category: str | None = None
    cost_price: int | None = Field(None, ge=0)
    selling_price: int | None = Field(None, ge=0)
    image_url: str | None = None
    naver_product_id: str | None = Field(None, max_length=50)
    model_code: str | None = Field(None, max_length=100)
    spec_keywords: list[str] | None = None
    price_filter_min_pct: int | None = Field(None, ge=0, le=100)
    price_filter_max_pct: int | None = Field(None, ge=100)
    # 제품 속성
    brand: str | None = Field(None, max_length=100)
    maker: str | None = Field(None, max_length=100)
    series: str | None = Field(None, max_length=100)
    capacity: str | None = Field(None, max_length=50)
    color: str | None = Field(None, max_length=50)
    material: str | None = Field(None, max_length=50)
    product_attributes: dict | None = None


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
    naver_product_id: str | None
    model_code: str | None
    spec_keywords: list[str] | None
    price_filter_min_pct: int | None
    price_filter_max_pct: int | None
    brand: str | None = None
    maker: str | None = None
    series: str | None = None
    capacity: str | None = None
    color: str | None = None
    material: str | None = None
    product_attributes: dict | None = None
    cost_preset_id: int | None = None
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
    model_code: str | None = None
    brand: str | None = None
    cost_preset_id: int | None = None
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
    naver_product_id: str | None
    is_relevant: bool
    hprice: int = 0
    brand: str | None = None
    maker: str | None = None
    shipping_fee: int = 0
    shipping_fee_type: str = "unknown"


class ExcludeProductRequest(BaseModel):
    naver_product_id: str = Field(..., min_length=1)
    naver_product_name: str | None = None
    mall_name: str | None = None


class ExcludedProductResponse(BaseModel):
    id: int
    naver_product_id: str
    naver_product_name: str | None
    mall_name: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class BulkDeleteRequest(BaseModel):
    product_ids: list[int] = Field(..., min_length=1)


class BulkDeleteResult(BaseModel):
    deleted: int


class ProductDetail(BaseModel):
    id: int
    user_id: int
    name: str
    category: str | None
    selling_price: int
    cost_price: int
    image_url: str | None
    naver_product_id: str | None
    model_code: str | None
    spec_keywords: list[str] | None
    price_filter_min_pct: int | None
    price_filter_max_pct: int | None
    brand: str | None = None
    maker: str | None = None
    series: str | None = None
    capacity: str | None = None
    color: str | None = None
    material: str | None = None
    product_attributes: dict | None = None
    cost_preset_id: int | None = None
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
