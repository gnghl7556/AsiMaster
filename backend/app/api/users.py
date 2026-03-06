import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.models.alert import AlertSetting
from app.models.user import User
from app.schemas.user import (
    PasswordVerifyRequest,
    PasswordVerifyResponse,
    UserCreate,
    UserResponse,
    UserUpdate,
)

router = APIRouter(prefix="/users", tags=["users"])


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


@router.get("", response_model=list[UserResponse])
async def get_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).order_by(User.name))
    return result.scalars().all()


@router.post("", response_model=UserResponse, status_code=201)
async def create_user(data: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.name == data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "이미 존재하는 사업체 이름입니다.")
    user = User(
        name=data.name,
        password_hash=_hash_password(data.password) if data.password else None,
    )
    db.add(user)
    await db.flush()

    # 기본 알림 설정 자동 생성
    for alert_type in ("price_undercut", "rank_drop"):
        db.add(AlertSetting(user_id=user.id, alert_type=alert_type, is_enabled=True))
    await db.flush()

    await db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "사업체를 찾을 수 없습니다.")
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(user_id: int, data: UserUpdate, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "사업체를 찾을 수 없습니다.")
    if data.name is not None:
        existing = await db.execute(select(User).where(User.name == data.name, User.id != user_id))
        if existing.scalar_one_or_none():
            raise HTTPException(400, "이미 존재하는 사업체 이름입니다.")
        user.name = data.name
    if data.naver_store_name is not None:
        user.naver_store_name = data.naver_store_name
    if data.crawl_interval_min is not None:
        user.crawl_interval_min = data.crawl_interval_min
    if data.remove_password:
        user.password_hash = None
    elif data.password is not None:
        user.password_hash = _hash_password(data.password)
    if data.telegram_chat_id is not None:
        user.telegram_chat_id = data.telegram_chat_id if data.telegram_chat_id else None
    await db.flush()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "사업체를 찾을 수 없습니다.")
    await db.delete(user)


@router.post("/{user_id}/telegram-test")
async def telegram_test(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "사업체를 찾을 수 없습니다.")
    if not user.telegram_chat_id:
        raise HTTPException(400, "텔레그램 chat_id가 설정되지 않았습니다.")

    from app.services.telegram_service import send_telegram_message
    from app.core.config import settings
    if not settings.TELEGRAM_BOT_TOKEN:
        raise HTTPException(400, "TELEGRAM_BOT_TOKEN이 설정되지 않았습니다.")

    ok = await send_telegram_message(user.telegram_chat_id, f"AsiMaster 테스트 알림\n{user.name} 사업체에서 보낸 테스트 메시지입니다.")
    if not ok:
        raise HTTPException(500, "텔레그램 전송에 실패했습니다.")
    return {"ok": True}


@router.post("/{user_id}/verify-password", response_model=PasswordVerifyResponse)
async def verify_password(user_id: int, data: PasswordVerifyRequest, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "사업체를 찾을 수 없습니다.")
    if not user.password_hash:
        return PasswordVerifyResponse(verified=True)
    verified = _verify_password(data.password, user.password_hash)
    return PasswordVerifyResponse(verified=verified)
