from pydantic import BaseModel


class VapidPublicKeyResponse(BaseModel):
    public_key: str


class PushSubscriptionCreate(BaseModel):
    user_id: int
    endpoint: str
    p256dh: str
    auth: str


class PushSubscriptionResponse(BaseModel):
    id: int
    user_id: int
    endpoint: str

    model_config = {"from_attributes": True}
