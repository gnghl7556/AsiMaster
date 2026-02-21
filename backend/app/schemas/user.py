from datetime import datetime

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class UserUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    naver_store_name: str | None = Field(None, max_length=200)
    crawl_interval_min: int | None = Field(None, ge=0, le=1440)


class UserResponse(BaseModel):
    id: int
    name: str
    naver_store_name: str | None
    crawl_interval_min: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
