from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.keyword_ranking import KeywordRanking
from app.models.product import Product
from app.models.search_keyword import SearchKeyword
from app.models.shipping_override import ShippingOverride


async def get_shipping_overrides(db: AsyncSession, product_id: int) -> list:
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "상품을 찾을 수 없습니다.")
    result = await db.execute(
        select(ShippingOverride)
        .where(ShippingOverride.product_id == product_id)
        .order_by(ShippingOverride.created_at.desc())
    )
    return result.scalars().all()


async def add_shipping_override(
    db: AsyncSession,
    product_id: int,
    naver_product_id: str,
    shipping_fee: int,
    naver_product_name: str | None,
    mall_name: str | None,
) -> ShippingOverride:
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "상품을 찾을 수 없습니다.")
    # 중복 체크
    existing = await db.execute(
        select(ShippingOverride).where(
            ShippingOverride.product_id == product_id,
            ShippingOverride.naver_product_id == naver_product_id,
        )
    )
    if existing.scalars().first():
        raise HTTPException(409, "이미 배송비가 설정된 상품입니다.")
    override = ShippingOverride(
        product_id=product_id,
        naver_product_id=naver_product_id,
        shipping_fee=shipping_fee,
        naver_product_name=naver_product_name,
        mall_name=mall_name,
    )
    db.add(override)
    # 기존 rankings 즉시 반영
    await _update_rankings_shipping(db, product_id, naver_product_id, shipping_fee)
    await db.flush()
    await db.refresh(override)
    return override


async def update_shipping_override(
    db: AsyncSession,
    product_id: int,
    naver_product_id: str,
    shipping_fee: int,
) -> ShippingOverride:
    result = await db.execute(
        select(ShippingOverride).where(
            ShippingOverride.product_id == product_id,
            ShippingOverride.naver_product_id == naver_product_id,
        )
    )
    override = result.scalars().first()
    if not override:
        raise HTTPException(404, "배송비 오버라이드를 찾을 수 없습니다.")
    override.shipping_fee = shipping_fee
    # 기존 rankings 즉시 반영
    await _update_rankings_shipping(db, product_id, naver_product_id, shipping_fee)
    await db.flush()
    await db.refresh(override)
    return override


async def remove_shipping_override(
    db: AsyncSession, product_id: int, naver_product_id: str
) -> None:
    result = await db.execute(
        select(ShippingOverride).where(
            ShippingOverride.product_id == product_id,
            ShippingOverride.naver_product_id == naver_product_id,
        )
    )
    override = result.scalars().first()
    if not override:
        raise HTTPException(404, "배송비 오버라이드를 찾을 수 없습니다.")
    await db.delete(override)
    # 삭제 시 rankings는 다음 크롤링에서 원본 배송비로 복원됨


async def _update_rankings_shipping(
    db: AsyncSession,
    product_id: int,
    naver_product_id: str,
    shipping_fee: int,
) -> None:
    """해당 상품 키워드의 기존 rankings에서 naver_product_id의 배송비를 즉시 업데이트."""
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
            .values(shipping_fee=shipping_fee, shipping_fee_type="paid")
        )
