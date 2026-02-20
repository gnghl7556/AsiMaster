from datetime import datetime

from pydantic import BaseModel


class AlertResponse(BaseModel):
    id: int
    user_id: int
    product_id: int | None
    type: str
    title: str
    message: str | None
    is_read: bool
    data: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AlertSettingResponse(BaseModel):
    id: int
    user_id: int
    alert_type: str
    is_enabled: bool
    threshold: float | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AlertSettingUpdate(BaseModel):
    alert_type: str
    is_enabled: bool
    threshold: float | None = None
