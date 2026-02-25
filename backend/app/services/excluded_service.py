from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.excluded_product import ExcludedProduct
from app.models.keyword_ranking import KeywordRanking
from app.models.product import Product
from app.models.search_keyword import SearchKeyword


async def get_excluded_list(db: AsyncSession, product_id: int) -> list:
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "상품을 찾을 수 없습니다.")
    result = await db.execute(
        select(ExcludedProduct)
        .where(ExcludedProduct.product_id == product_id)
        .order_by(ExcludedProduct.created_at.desc())
    )
    return result.scalars().all()


async def add_excluded(
    db: AsyncSession,
    product_id: int,
    naver_product_id: str,
    naver_product_name: str | None,
    mall_name: str | None,
) -> ExcludedProduct:
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "상품을 찾을 수 없습니다.")
    # 중복 체크
    existing = await db.execute(
        select(ExcludedProduct).where(
            ExcludedProduct.product_id == product_id,
            ExcludedProduct.naver_product_id == naver_product_id,
        )
    )
    if existing.scalars().first():
        raise HTTPException(409, "이미 제외된 상품입니다.")
    excluded = ExcludedProduct(
        product_id=product_id,
        naver_product_id=naver_product_id,
        naver_product_name=naver_product_name,
        mall_name=mall_name,
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
                KeywordRanking.naver_product_id == naver_product_id,
            )
            .values(is_relevant=False)
        )
    await db.flush()
    await db.refresh(excluded)
    return excluded


async def remove_excluded(
    db: AsyncSession, product_id: int, naver_product_id: str
) -> None:
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
