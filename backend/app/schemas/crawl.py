from datetime import datetime

from pydantic import BaseModel


class CrawlKeywordResult(BaseModel):
    keyword_id: int
    keyword: str
    items_count: int
    success: bool
    error: str | None


class CrawlBatchResult(BaseModel):
    total: int
    success: int
    failed: int


class CrawlStatus(BaseModel):
    is_running: bool
    last_run_at: datetime | None
    next_run_at: datetime | None
    total_keywords: int
    last_success_rate: float | None


class CrawlLogResponse(BaseModel):
    id: int
    keyword_id: int | None
    status: str
    error_message: str | None
    duration_ms: int | None
    created_at: datetime

    model_config = {"from_attributes": True}
