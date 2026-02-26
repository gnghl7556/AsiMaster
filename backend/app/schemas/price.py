from datetime import datetime

from pydantic import BaseModel


class PriceHistoryItem(BaseModel):
    keyword_id: int
    rank: int
    product_name: str
    price: int
    mall_name: str
    is_my_store: bool
    crawled_at: datetime


class PriceSnapshotItem(BaseModel):
    keyword_id: int
    keyword: str
    rank: int
    product_name: str
    price: int
    mall_name: str
    is_my_store: bool
    crawled_at: datetime
