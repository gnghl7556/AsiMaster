from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DuplicateError, NotFoundError
from app.models.included_override import IncludedOverride
from app.models.keyword_ranking import KeywordRanking
from app.models.product import Product
from app.models.search_keyword import SearchKeyword


async def get_included_overrides(db: AsyncSession, product_id: int) -> list:
    result = await db.execute(
        select(IncludedOverride)
        .where(IncludedOverride.product_id == product_id)
        .order_by(IncludedOverride.created_at.desc())
    )
    return result.scalars().all()


async def add_included_override(
    db: AsyncSession,
    product_id: int,
    naver_product_id: str,
    naver_product_name: str | None,
    mall_name: str | None,
) -> IncludedOverride:
    product = await db.get(Product, product_id)
    if not product:
        raise NotFoundError("상품을 찾을 수 없습니다.")
    # 중복 체크
    existing = await db.execute(
        select(IncludedOverride).where(
            IncludedOverride.product_id == product_id,
            IncludedOverride.naver_product_id == naver_product_id,
        )
    )
    if existing.scalars().first():
        raise DuplicateError("이미 수동 포함 예외에 등록된 상품입니다.")
    override = IncludedOverride(
        product_id=product_id,
        naver_product_id=naver_product_id,
        naver_product_name=naver_product_name,
        mall_name=mall_name,
    )
    db.add(override)
    await db.flush()
    await db.refresh(override)
    # 즉시 반영: 해당 상품 키워드의 최신 rankings에서 이 naver_product_id → is_relevant=True
    kw_result = await db.execute(
        select(SearchKeyword.id).where(
            SearchKeyword.product_id == product_id,
            SearchKeyword.is_active == True,
        )
    )
    kw_ids = kw_result.scalars().all()
    if kw_ids:
        await db.execute(
            update(KeywordRanking)
            .where(
                KeywordRanking.keyword_id.in_(kw_ids),
                KeywordRanking.naver_product_id == naver_product_id,
                KeywordRanking.is_relevant == False,
            )
            .values(is_relevant=True, relevance_reason="included_override")
        )
        await db.flush()
    return override


async def remove_included_override(
    db: AsyncSession, product_id: int, naver_product_id: str
) -> None:
    result = await db.execute(
        select(IncludedOverride).where(
            IncludedOverride.product_id == product_id,
            IncludedOverride.naver_product_id == naver_product_id,
        )
    )
    override = result.scalars().first()
    if not override:
        raise NotFoundError("수동 포함 예외를 찾을 수 없습니다.")
    await db.delete(override)
    # 기존 rankings는 다음 크롤링에서 재판정
