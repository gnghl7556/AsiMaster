from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class KeywordCreate(BaseModel):
    keyword: str = Field(..., min_length=1, max_length=200)
    sort_type: Literal["sim", "asc"] = "sim"


class KeywordResponse(BaseModel):
    id: int
    product_id: int
    keyword: str
    sort_type: str
    is_primary: bool
    is_active: bool
    last_crawled_at: datetime | None
    crawl_status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class RankingItemResponse(BaseModel):
    id: int
    rank: int
    product_name: str
    price: int
    mall_name: str
    product_url: str | None
    image_url: str | None
    naver_product_id: str | None
    is_my_store: bool
    is_relevant: bool
    crawled_at: datetime

    model_config = {"from_attributes": True}


class KeywordWithRankings(BaseModel):
    id: int
    keyword: str
    is_primary: bool
    crawl_status: str
    last_crawled_at: datetime | None
    rankings: list[RankingItemResponse]
