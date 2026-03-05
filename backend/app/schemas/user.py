from datetime import datetime

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    password: str | None = Field(None, min_length=4, max_length=100)


class UserUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    naver_store_name: str | None = Field(None, max_length=200)
    crawl_interval_min: int | None = Field(None, ge=0, le=1440)
    password: str | None = Field(None, min_length=4, max_length=100)
    remove_password: bool = False


class UserResponse(BaseModel):
    id: int
    name: str
    naver_store_name: str | None
    crawl_interval_min: int
    has_password: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PasswordVerifyRequest(BaseModel):
    password: str = Field(..., min_length=1)


class PasswordVerifyResponse(BaseModel):
    verified: bool
