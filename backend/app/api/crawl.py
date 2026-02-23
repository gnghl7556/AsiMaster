from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.core.utils import utcnow
from app.crawlers.manager import shared_manager as manager, CrawlAlreadyRunningError
from app.models.crawl_log import CrawlLog
from app.models.product import Product
from app.models.search_keyword import SearchKeyword
from app.schemas.crawl import CrawlBatchResult, CrawlKeywordResult, CrawlLogResponse

router = APIRouter(prefix="/crawl", tags=["crawl"])


@router.post("/product/{product_id}")
async def crawl_product(product_id: int, db: AsyncSession = Depends(get_db)):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "상품을 찾을 수 없습니다.")

    try:
        results = await manager.crawl_product(db, product_id)
    except CrawlAlreadyRunningError:
        raise HTTPException(409, "이미 크롤링이 진행 중입니다.")
    return [
        CrawlKeywordResult(
            keyword_id=0,
            keyword=r.keyword,
            items_count=len(r.items),
            success=r.success,
            error=r.error,
        )
        for r in results
    ]


@router.post("/user/{user_id}")
async def crawl_user(user_id: int, db: AsyncSession = Depends(get_db)):
    try:
        result = await manager.crawl_user_all(db, user_id)
    except CrawlAlreadyRunningError:
        raise HTTPException(409, "이미 크롤링이 진행 중입니다.")
    return CrawlBatchResult(
        total=result["total"],
        success=result["success"],
        failed=result["failed"],
    )


@router.get("/status/{user_id}")
async def get_crawl_status(user_id: int, db: AsyncSession = Depends(get_db)):
    # 전체 키워드 수
    total_q = await db.execute(
        select(func.count())
        .select_from(SearchKeyword)
        .join(Product, SearchKeyword.product_id == Product.id)
        .where(Product.user_id == user_id, SearchKeyword.is_active == True)
    )
    total = total_q.scalar_one()

    # 최근 24시간 성공/실패
    since = utcnow() - timedelta(hours=24)
    log_q = await db.execute(
        select(CrawlLog.status, func.count())
        .where(CrawlLog.created_at >= since)
        .group_by(CrawlLog.status)
    )
    status_counts = dict(log_q.all())

    # 평균 크롤링 소요 시간
    avg_q = await db.execute(
        select(func.avg(CrawlLog.duration_ms))
        .where(CrawlLog.created_at >= since, CrawlLog.status == "success")
    )
    avg_duration = avg_q.scalar_one_or_none()

    return {
        "total_keywords": total,
        "last_24h_success": status_counts.get("success", 0),
        "last_24h_failed": status_counts.get("failed", 0),
        "avg_duration_ms": round(avg_duration) if avg_duration else None,
    }


@router.get("/logs/{user_id}", response_model=list[CrawlLogResponse])
async def get_crawl_logs(
    user_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * size
    result = await db.execute(
        select(CrawlLog)
        .join(SearchKeyword, CrawlLog.keyword_id == SearchKeyword.id)
        .join(Product, SearchKeyword.product_id == Product.id)
        .where(Product.user_id == user_id)
        .order_by(CrawlLog.created_at.desc())
        .offset(offset)
        .limit(size)
    )
    return result.scalars().all()
