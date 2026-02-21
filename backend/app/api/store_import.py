from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.crawlers.store_scraper import fetch_store_products, suggest_keywords
from app.models.product import Product
from app.models.search_keyword import SearchKeyword
from app.models.user import User
from app.schemas.store_import import (
    StoreImportRequest,
    StoreImportResult,
    StoreProductItem,
)

router = APIRouter(tags=["store-import"])


@router.get("/users/{user_id}/store/products", response_model=list[StoreProductItem])
async def preview_store_products(
    user_id: int,
    store_url: str = Query(..., description="스마트스토어 URL (예: https://smartstore.naver.com/asmt)"),
    db: AsyncSession = Depends(get_db),
):
    """스마트스토어 상품 목록 미리보기 (DB 저장 안함)."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "사업체를 찾을 수 없습니다.")

    try:
        products = await fetch_store_products(
            store_url, fallback_store_name=user.naver_store_name,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    return [
        StoreProductItem(
            name=p.name,
            price=p.price,
            image_url=p.image_url,
            category=p.category,
            naver_product_id=p.naver_product_id,
            suggested_keywords=suggest_keywords(p.name, p.mall_name),
        )
        for p in products
    ]


@router.post("/users/{user_id}/store/import", response_model=StoreImportResult)
async def import_store_products(
    user_id: int,
    data: StoreImportRequest,
    db: AsyncSession = Depends(get_db),
):
    """선택한 상품 일괄 등록."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "사업체를 찾을 수 없습니다.")

    # 기존 상품명 조회 (중복 체크용)
    result = await db.execute(
        select(Product.name).where(
            Product.user_id == user_id,
            Product.is_active == True,
        )
    )
    existing_names = {name.lower() for name in result.scalars().all()}

    created = 0
    skipped = 0
    skipped_names = []

    for item in data.products:
        if item.name.lower() in existing_names:
            skipped += 1
            skipped_names.append(item.name)
            continue

        product = Product(
            user_id=user_id,
            name=item.name,
            selling_price=item.selling_price,
            cost_price=0,
            image_url=item.image_url,
            category=item.category,
        )
        db.add(product)
        await db.flush()

        # 키워드 등록: 사용자 선택 키워드 또는 기본 상품명
        kw_list = item.keywords if item.keywords else [item.name]
        for i, kw in enumerate(kw_list):
            db.add(SearchKeyword(
                product_id=product.id,
                keyword=kw,
                is_primary=(i == 0),
            ))
        await db.flush()

        existing_names.add(item.name.lower())
        created += 1

    return StoreImportResult(
        created=created,
        skipped=skipped,
        skipped_names=skipped_names,
    )
