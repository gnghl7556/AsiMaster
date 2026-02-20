from datetime import datetime

from pydantic import BaseModel


class StatusCounts(BaseModel):
    winning: int = 0
    close: int = 0
    losing: int = 0


class DashboardSummary(BaseModel):
    total_products: int
    active_products: int
    price_locked_products: int
    status_counts: StatusCounts
    avg_margin_percent: float | None
    unread_alerts: int
    last_crawled_at: datetime | None
    crawl_success_rate: float | None
