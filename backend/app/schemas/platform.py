from datetime import datetime

from pydantic import BaseModel


class PlatformResponse(BaseModel):
    id: int
    name: str
    display_name: str
    base_url: str | None
    is_default: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserPlatformResponse(BaseModel):
    id: int
    user_id: int
    platform_id: int
    platform_name: str
    platform_display_name: str
    is_active: bool
    crawl_interval_min: int

    model_config = {"from_attributes": True}


class UserPlatformUpdate(BaseModel):
    is_active: bool | None = None
    crawl_interval_min: int | None = None
