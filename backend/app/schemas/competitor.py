from datetime import datetime

from pydantic import BaseModel, Field


class CompetitorCreate(BaseModel):
    platform_id: int
    url: str | None = Field(None, max_length=1000)


class CompetitorUpdate(BaseModel):
    url: str | None = Field(None, max_length=1000)
    is_active: bool | None = None


class CompetitorResponse(BaseModel):
    id: int
    product_id: int
    platform_id: int
    url: str | None
    seller_name: str | None
    is_active: bool
    last_crawled_at: datetime | None
    crawl_status: str
    created_at: datetime

    model_config = {"from_attributes": True}
