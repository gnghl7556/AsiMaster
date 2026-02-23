"""DB 기반 브랜드/카테고리 사전 — 24시간 TTL 캐시."""

import logging
import time

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.keyword_ranking import KeywordRanking

logger = logging.getLogger(__name__)

_TTL = 86400  # 24시간

_brand_cache: set[str] = set()
_brand_ts: float = 0.0

_type_cache: set[str] = set()
_type_ts: float = 0.0


async def build_brand_dict(db: AsyncSession) -> set[str]:
    """keyword_rankings에서 DISTINCT brand + maker 수집 (소문자)."""
    global _brand_cache, _brand_ts

    if _brand_cache and (time.monotonic() - _brand_ts) < _TTL:
        return _brand_cache

    brands: set[str] = set()

    # brand
    result = await db.execute(
        select(func.lower(KeywordRanking.brand))
        .where(KeywordRanking.brand.isnot(None), KeywordRanking.brand != "")
        .distinct()
    )
    for row in result.scalars().all():
        if row:
            brands.add(row.strip())

    # maker
    result = await db.execute(
        select(func.lower(KeywordRanking.maker))
        .where(KeywordRanking.maker.isnot(None), KeywordRanking.maker != "")
        .distinct()
    )
    for row in result.scalars().all():
        if row:
            brands.add(row.strip())

    _brand_cache = brands
    _brand_ts = time.monotonic()
    logger.info(f"브랜드 사전 갱신: {len(brands)}개")
    return brands


async def build_type_dict(db: AsyncSession) -> set[str]:
    """keyword_rankings에서 DISTINCT category1~4 수집 (소문자)."""
    global _type_cache, _type_ts

    if _type_cache and (time.monotonic() - _type_ts) < _TTL:
        return _type_cache

    types: set[str] = set()
    for col in [
        KeywordRanking.category1,
        KeywordRanking.category2,
        KeywordRanking.category3,
        KeywordRanking.category4,
    ]:
        result = await db.execute(
            select(func.lower(col))
            .where(col.isnot(None), col != "")
            .distinct()
        )
        for row in result.scalars().all():
            if row:
                types.add(row.strip())

    _type_cache = types
    _type_ts = time.monotonic()
    logger.info(f"카테고리 사전 갱신: {len(types)}개")
    return types
