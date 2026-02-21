from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.models.excluded_product import ExcludedProduct
from app.models.keyword_ranking import KeywordRanking
from app.models.product import Product
from app.models.search_keyword import SearchKeyword
from app.models.user import User
from app.schemas.product import (
    ExcludeProductRequest,
    ExcludedProductResponse,
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
    page: int = Query(1, ge=1, description="페이지 번호"),
    limit: int = Query(50, ge=1, le=200, description="페이지당 항목 수"),
    db: AsyncSession = Depends(get_db),
):
    return await get_product_list_items(
        db, user_id, sort_by=sort or "urgency", category=category, search=search,
        page=page, limit=limit,
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


@router.get("/products/{product_id}", response_model=ProductDetail)
async def get_product(product_id: int, db: AsyncSession = Depends(get_db)):
    detail = await get_product_detail(db, product_id)
    if not detail:
        raise HTTPException(404, "상품을 찾을 수 없습니다.")
    return detail


@router.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int, data: ProductUpdate, db: AsyncSession = Depends(get_db)
):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "상품을 찾을 수 없습니다.")
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)
    await db.flush()
    await db.refresh(product)
    return product


@router.delete("/products/{product_id}", status_code=204)
async def delete_product(product_id: int, db: AsyncSession = Depends(get_db)):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "상품을 찾을 수 없습니다.")
    await db.delete(product)


@router.patch("/products/{product_id}/price-lock", response_model=ProductResponse)
async def toggle_price_lock(
    product_id: int, data: PriceLockUpdate, db: AsyncSession = Depends(get_db)
):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "상품을 찾을 수 없습니다.")
    product.is_price_locked = data.is_locked
    product.price_lock_reason = data.reason if data.is_locked else None
    await db.flush()
    await db.refresh(product)
    return product


# --- 블랙리스트 (경쟁사 제외) ---

@router.get("/products/{product_id}/excluded", response_model=list[ExcludedProductResponse])
async def get_excluded_products(product_id: int, db: AsyncSession = Depends(get_db)):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "상품을 찾을 수 없습니다.")
    result = await db.execute(
        select(ExcludedProduct)
        .where(ExcludedProduct.product_id == product_id)
        .order_by(ExcludedProduct.created_at.desc())
    )
    return result.scalars().all()


@router.post("/products/{product_id}/excluded", response_model=ExcludedProductResponse, status_code=201)
async def exclude_product(
    product_id: int, data: ExcludeProductRequest, db: AsyncSession = Depends(get_db)
):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "상품을 찾을 수 없습니다.")
    # 중복 체크
    existing = await db.execute(
        select(ExcludedProduct).where(
            ExcludedProduct.product_id == product_id,
            ExcludedProduct.naver_product_id == data.naver_product_id,
        )
    )
    if existing.scalars().first():
        raise HTTPException(409, "이미 제외된 상품입니다.")
    excluded = ExcludedProduct(
        product_id=product_id,
        naver_product_id=data.naver_product_id,
        naver_product_name=data.naver_product_name,
    )
    db.add(excluded)
    # 기존 랭킹에서 해당 naver_product_id를 is_relevant=False로 즉시 반영
    keyword_ids_result = await db.execute(
        select(SearchKeyword.id).where(SearchKeyword.product_id == product_id)
    )
    keyword_ids = keyword_ids_result.scalars().all()
    if keyword_ids:
        await db.execute(
            update(KeywordRanking)
            .where(
                KeywordRanking.keyword_id.in_(keyword_ids),
                KeywordRanking.naver_product_id == data.naver_product_id,
            )
            .values(is_relevant=False)
        )
    await db.flush()
    await db.refresh(excluded)
    return excluded


@router.delete("/products/{product_id}/excluded/{naver_product_id}", status_code=204)
async def unexclude_product(
    product_id: int, naver_product_id: str, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ExcludedProduct).where(
            ExcludedProduct.product_id == product_id,
            ExcludedProduct.naver_product_id == naver_product_id,
        )
    )
    excluded = result.scalars().first()
    if not excluded:
        raise HTTPException(404, "제외 목록에 없는 상품입니다.")
    await db.delete(excluded)
    # 기존 랭킹에서 해당 naver_product_id를 is_relevant=True로 복원
    keyword_ids_result = await db.execute(
        select(SearchKeyword.id).where(SearchKeyword.product_id == product_id)
    )
    keyword_ids = keyword_ids_result.scalars().all()
    if keyword_ids:
        await db.execute(
            update(KeywordRanking)
            .where(
                KeywordRanking.keyword_id.in_(keyword_ids),
                KeywordRanking.naver_product_id == naver_product_id,
            )
            .values(is_relevant=True)
        )


# --- 이전 경로 호환 (프론트엔드 마이그레이션 전까지 유지) ---

@router.get("/users/{user_id}/products/{product_id}", response_model=ProductDetail, include_in_schema=False)
async def get_product_compat(user_id: int, product_id: int, db: AsyncSession = Depends(get_db)):
    return await get_product(product_id, db)


@router.put("/users/{user_id}/products/{product_id}", response_model=ProductResponse, include_in_schema=False)
async def update_product_compat(user_id: int, product_id: int, data: ProductUpdate, db: AsyncSession = Depends(get_db)):
    return await update_product(product_id, data, db)


@router.delete("/users/{user_id}/products/{product_id}", status_code=204, include_in_schema=False)
async def delete_product_compat(user_id: int, product_id: int, db: AsyncSession = Depends(get_db)):
    return await delete_product(product_id, db)


@router.patch("/users/{user_id}/products/{product_id}/price-lock", response_model=ProductResponse, include_in_schema=False)
async def toggle_price_lock_compat(user_id: int, product_id: int, data: PriceLockUpdate, db: AsyncSession = Depends(get_db)):
    return await toggle_price_lock(product_id, data, db)
