from datetime import datetime

from pydantic import BaseModel


class CrawlResultResponse(BaseModel):
    competitor_id: int
    platform: str
    price: int | None
    shipping_fee: int | None
    total_price: int | None
    success: bool
    error: str | None


class CrawlBatchResult(BaseModel):
    total: int
    success: int
    failed: int
    results: list[CrawlResultResponse]


class CrawlStatus(BaseModel):
    is_running: bool
    last_run_at: datetime | None
    next_run_at: datetime | None
    total_competitors: int
    last_success_rate: float | None


class CrawlLogResponse(BaseModel):
    id: int
    competitor_id: int | None
    platform_id: int
    status: str
    error_message: str | None
    duration_ms: int | None
    created_at: datetime

    model_config = {"from_attributes": True}
