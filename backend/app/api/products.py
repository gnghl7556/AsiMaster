from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.models.product import Product
from app.models.search_keyword import SearchKeyword
from app.models.user import User
from app.schemas.product import (
    PriceLockUpdate,
    ProductCreate,
    ProductDetail,
    ProductListItem,
    ProductResponse,
    ProductUpdate,
)
from app.services.product_service import get_product_detail, get_product_list_items

router = APIRouter(tags=["products"])


@router.get("/users/{user_id}/products", response_model=list[ProductListItem])
async def get_products(
    user_id: int,
    category: str | None = None,
    search: str | None = None,
    sort: str | None = Query(None, description="urgency|margin|rank_drop|category"),
    db: AsyncSession = Depends(get_db),
):
    return await get_product_list_items(
        db, user_id, sort_by=sort or "urgency", category=category, search=search,
    )


@router.post("/users/{user_id}/products", response_model=ProductResponse, status_code=201)
async def create_product(user_id: int, data: ProductCreate, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "사업체를 찾을 수 없습니다.")
    product = Product(user_id=user_id, **data.model_dump())
    db.add(product)
    await db.flush()

    # 상품명으로 기본 키워드 자동 등록
    keyword = SearchKeyword(
        product_id=product.id,
        keyword=product.name,
        is_primary=True,
    )
    db.add(keyword)
    await db.flush()

    await db.refresh(product)
    return product


@router.get("/users/{user_id}/products/{product_id}", response_model=ProductDetail)
async def get_product(user_id: int, product_id: int, db: AsyncSession = Depends(get_db)):
    detail = await get_product_detail(db, user_id, product_id)
    if not detail:
        raise HTTPException(404, "상품을 찾을 수 없습니다.")
    return detail


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
