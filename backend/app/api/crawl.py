from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.crawlers.manager import CrawlManager
from app.models.competitor import Competitor
from app.models.crawl_log import CrawlLog
from app.models.product import Product
from app.schemas.crawl import CrawlBatchResult, CrawlLogResponse, CrawlResultResponse

router = APIRouter(prefix="/crawl", tags=["crawl"])

manager = CrawlManager()


@router.post("/product/{product_id}")
async def crawl_product(product_id: int, db: AsyncSession = Depends(get_db)):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "상품을 찾을 수 없습니다.")

    results = await manager.crawl_product(db, product_id)
    return [
        CrawlResultResponse(
            competitor_id=0,
            platform="",
            price=r.price,
            shipping_fee=r.shipping_fee,
            total_price=(r.price + r.shipping_fee) if r.price else None,
            success=r.success,
            error=r.error,
        )
        for r in results
    ]


@router.post("/user/{user_id}")
async def crawl_user(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await manager.crawl_user_all(db, user_id)
    return CrawlBatchResult(
        total=result["total"],
        success=result["success"],
        failed=result["failed"],
        results=[],
    )


@router.get("/status/{user_id}")
async def get_crawl_status(user_id: int, db: AsyncSession = Depends(get_db)):
    """사용자의 크롤링 현황 조회."""
    # 전체 경쟁사 수
    total_q = await db.execute(
        select(func.count())
        .select_from(Competitor)
        .join(Product, Competitor.product_id == Product.id)
        .where(Product.user_id == user_id, Competitor.is_active == True)
    )
    total = total_q.scalar_one()

    # 최근 24시간 성공/실패
    from datetime import datetime, timedelta, timezone

    since = datetime.now(timezone.utc) - timedelta(hours=24)
    log_q = await db.execute(
        select(CrawlLog.status, func.count())
        .join(Competitor, CrawlLog.competitor_id == Competitor.id)
        .join(Product, Competitor.product_id == Product.id)
        .where(Product.user_id == user_id, CrawlLog.created_at >= since)
        .group_by(CrawlLog.status)
    )
    status_counts = dict(log_q.all())

    return {
        "total_competitors": total,
        "last_24h_success": status_counts.get("success", 0),
        "last_24h_failed": status_counts.get("failed", 0),
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
        .join(Competitor, CrawlLog.competitor_id == Competitor.id)
        .join(Product, Competitor.product_id == Product.id)
        .where(Product.user_id == user_id)
        .order_by(CrawlLog.created_at.desc())
        .offset(offset)
        .limit(size)
    )
    return result.scalars().all()
