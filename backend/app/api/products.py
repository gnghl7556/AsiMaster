from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.models.competitor import Competitor
from app.models.platform import Platform
from app.models.product import Product
from app.models.user import User
from app.schemas.product import (
    PriceLockUpdate,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
)

router = APIRouter(tags=["products"])


@router.get("/users/{user_id}/products", response_model=list[ProductResponse])
async def get_products(
    user_id: int,
    category: str | None = None,
    search: str | None = None,
    price_locked: bool | None = None,
    sort: str | None = Query(None, description="urgency|margin|rank_drop|category"),
    page: int = Query(1, ge=1),
    size: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    query = select(Product).where(Product.user_id == user_id, Product.is_active == True)
    if category:
        query = query.where(Product.category == category)
    if search:
        query = query.where(Product.name.ilike(f"%{search}%"))
    if price_locked is not None:
        query = query.where(Product.is_price_locked == price_locked)
    if sort == "category":
        query = query.order_by(Product.category, Product.name)
    else:
        query = query.order_by(Product.created_at.desc())
    offset = (page - 1) * size
    query = query.offset(offset).limit(size)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/users/{user_id}/products", response_model=ProductResponse, status_code=201)
async def create_product(user_id: int, data: ProductCreate, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "사업체를 찾을 수 없습니다.")
    product = Product(user_id=user_id, **data.model_dump())
    db.add(product)
    await db.flush()

    # 네이버 Competitor 자동 생성
    naver_platform = (
        await db.execute(select(Platform).where(Platform.name == "naver"))
    ).scalars().first()
    if naver_platform:
        competitor = Competitor(
            product_id=product.id,
            platform_id=naver_platform.id,
            url="",
        )
        db.add(competitor)
        await db.flush()

    await db.refresh(product)
    return product


@router.get("/users/{user_id}/products/{product_id}", response_model=ProductResponse)
async def get_product(user_id: int, product_id: int, db: AsyncSession = Depends(get_db)):
    product = await db.get(Product, product_id)
    if not product or product.user_id != user_id:
        raise HTTPException(404, "상품을 찾을 수 없습니다.")
    return product


@router.put("/users/{user_id}/products/{product_id}", response_model=ProductResponse)
async def update_product(
    user_id: int, product_id: int, data: ProductUpdate, db: AsyncSession = Depends(get_db)
):
    product = await db.get(Product, product_id)
    if not product or product.user_id != user_id:
        raise HTTPException(404, "상품을 찾을 수 없습니다.")
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)
    await db.flush()
    await db.refresh(product)
    return product


@router.delete("/users/{user_id}/products/{product_id}", status_code=204)
async def delete_product(user_id: int, product_id: int, db: AsyncSession = Depends(get_db)):
    product = await db.get(Product, product_id)
    if not product or product.user_id != user_id:
        raise HTTPException(404, "상품을 찾을 수 없습니다.")
    await db.delete(product)


@router.patch("/users/{user_id}/products/{product_id}/price-lock", response_model=ProductResponse)
async def toggle_price_lock(
    user_id: int, product_id: int, data: PriceLockUpdate, db: AsyncSession = Depends(get_db)
):
    product = await db.get(Product, product_id)
    if not product or product.user_id != user_id:
        raise HTTPException(404, "상품을 찾을 수 없습니다.")
    product.is_price_locked = data.is_locked
    product.price_lock_reason = data.reason if data.is_locked else None
    await db.flush()
    await db.refresh(product)
    return product
