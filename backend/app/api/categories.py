from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.schemas.category import NaverCategoryTree
from app.services.category_service import get_naver_category_tree

router = APIRouter(tags=["categories"])


@router.get("/naver-categories", response_model=NaverCategoryTree)
async def get_naver_categories(db: AsyncSession = Depends(get_db)):
    """크롤링된 keyword_rankings에서 네이버 카테고리 트리 구조를 반환."""
    return await get_naver_category_tree(db)
