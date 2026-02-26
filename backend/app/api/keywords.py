import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_db
from app.models.product import Product
from app.models.search_keyword import SearchKeyword
from app.schemas.keyword_suggest import (
    KeywordSuggestRequest,
    KeywordSuggestionResponse,
    SuggestedKeyword,
    TokenItem,
)
from app.schemas.search_keyword import KeywordCreate, KeywordResponse
from app.services.keyword_engine.classifier import classify_tokens
from app.services.keyword_engine.dictionary import build_brand_dict, build_type_dict
from app.services.keyword_engine.generator import generate_keywords

router = APIRouter(tags=["keywords"])


@router.get("/products/{product_id}/keywords", response_model=list[KeywordResponse])
async def get_keywords(product_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SearchKeyword)
        .where(SearchKeyword.product_id == product_id)
        .order_by(SearchKeyword.is_primary.desc(), SearchKeyword.created_at)
    )
    return result.scalars().all()


@router.post("/products/{product_id}/keywords", response_model=KeywordResponse, status_code=201)
async def create_keyword(
    product_id: int, data: KeywordCreate, db: AsyncSession = Depends(get_db)
):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "상품을 찾을 수 없습니다.")

    # 키워드 수 제한
    count_result = await db.execute(
        select(func.count()).where(
            SearchKeyword.product_id == product_id,
            SearchKeyword.is_active == True,
        )
    )
    count = count_result.scalar_one()
    if count >= settings.MAX_KEYWORDS_PER_PRODUCT:
        raise HTTPException(400, f"키워드는 최대 {settings.MAX_KEYWORDS_PER_PRODUCT}개까지 등록 가능합니다.")

    # 중복 확인
    dup_result = await db.execute(
        select(SearchKeyword).where(
            SearchKeyword.product_id == product_id,
            SearchKeyword.keyword == data.keyword,
        )
    )
    if dup_result.scalar_one_or_none():
        raise HTTPException(400, "이미 등록된 키워드입니다.")

    keyword = SearchKeyword(
        product_id=product_id,
        keyword=data.keyword,
        sort_type=data.sort_type,
        is_primary=False,
    )
    db.add(keyword)
    await db.flush()
    await db.refresh(keyword)
    return keyword


@router.delete("/keywords/{keyword_id}", status_code=204)
async def delete_keyword(keyword_id: int, db: AsyncSession = Depends(get_db)):
    keyword = await db.get(SearchKeyword, keyword_id)
    if not keyword:
        raise HTTPException(404, "키워드를 찾을 수 없습니다.")
    if keyword.is_primary:
        raise HTTPException(400, "기본 키워드는 삭제할 수 없습니다.")
    await db.delete(keyword)


@router.post("/keywords/suggest", response_model=KeywordSuggestionResponse)
async def suggest_keywords(
    data: KeywordSuggestRequest,
    db: AsyncSession = Depends(get_db),
):
    """SEO 기반 키워드 추천."""
    name = data.product_name.strip()

    # 스토어명 제거
    if data.store_name:
        for variant in [data.store_name, data.store_name.replace(" ", "")]:
            name = re.sub(re.escape(variant), "", name, flags=re.IGNORECASE).strip()

    # DB 사전 로드
    db_brands = await build_brand_dict(db)
    db_types = await build_type_dict(db)

    # 토큰 분류
    tokens = classify_tokens(name, db_brands, db_types)

    # 키워드 생성
    generated = generate_keywords(tokens)

    # field_guide: 첫 번째 BRAND, category_hint 또는 첫 TYPE
    brand_token = next((t for t in tokens if t.category == "BRAND"), None)
    type_token = next((t for t in tokens if t.category == "TYPE"), None)

    return KeywordSuggestionResponse(
        tokens=[
            TokenItem(text=t.text, category=t.category, weight=t.weight)
            for t in tokens
        ],
        keywords=[
            SuggestedKeyword(keyword=g.keyword, score=g.score, level=g.level)
            for g in generated
        ],
        field_guide={
            "brand": brand_token.text if brand_token else None,
            "category": data.category_hint or (type_token.text if type_token else None),
        },
    )
