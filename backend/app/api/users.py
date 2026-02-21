from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserResponse])
async def get_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).order_by(User.name))
    return result.scalars().all()


@router.post("", response_model=UserResponse, status_code=201)
async def create_user(data: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.name == data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "이미 존재하는 사업체 이름입니다.")
    user = User(name=data.name)
    db.add(user)
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
    await db.flush()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "사업체를 찾을 수 없습니다.")
    await db.delete(user)
