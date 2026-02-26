import logging
from datetime import datetime, timedelta

from sqlalchemy import delete, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import async_session
from app.core.utils import utcnow
from app.crawlers.manager import shared_manager
from app.models.crawl_log import CrawlLog
from app.models.keyword_ranking import KeywordRanking
from app.models.product import Product
from app.models.search_keyword import SearchKeyword
from app.models.user import User

logger = logging.getLogger(__name__)


async def _get_user_last_crawled(db: AsyncSession, user_id: int) -> datetime | None:
    """유저의 모든 상품 키워드 중 가장 최근 크롤링 시각 조회"""
    result = await db.execute(
        select(func.max(SearchKeyword.last_crawled_at))
        .join(Product, SearchKeyword.product_id == Product.id)
        .where(Product.user_id == user_id, Product.is_active == True)
    )
    return result.scalar_one_or_none()


async def crawl_all_users():
    """크롤링 주기가 도래한 사업체의 활성 상품을 크롤링"""
    # 1. 유저 목록 조회 세션
    async with async_session() as db:
        try:
            result = await db.execute(select(User))
            users = result.scalars().all()
        except Exception as e:
            logger.error(f"유저 목록 조회 실패: {e}")
            return

    now = utcnow()

    # 2. 유저별 독립 세션으로 크롤링
    for user in users:
        if user.crawl_interval_min <= 0:
            continue

        async with async_session() as db:
            try:
                last_crawled = await _get_user_last_crawled(db, user.id)
                if last_crawled:
                    elapsed = now - last_crawled
                    if elapsed < timedelta(minutes=user.crawl_interval_min):
                        logger.debug(
                            f"크롤링 스킵: {user.name} "
                            f"(다음 크롤링까지 {user.crawl_interval_min - int(elapsed.total_seconds() / 60)}분)"
                        )
                        continue

                logger.info(f"크롤링 시작: {user.name} (ID: {user.id}, 주기: {user.crawl_interval_min}분)")
                stats = await shared_manager.crawl_user_all(db, user.id)
                await db.commit()
                logger.info(
                    f"크롤링 완료: {user.name} - "
                    f"총 {stats['total']}건, 성공 {stats['success']}건, 실패 {stats['failed']}건"
                )
            except Exception as e:
                await db.rollback()
                logger.error(f"크롤링 실패: {user.name} - {e}")


async def cleanup_old_rankings():
    """오래된 keyword_rankings + crawl_logs 배치 삭제."""
    cutoff = utcnow() - timedelta(days=settings.DATA_RETENTION_DAYS)
    batch_size = settings.CLEANUP_BATCH_SIZE
    async with async_session() as db:
        try:
            # keyword_rankings 삭제
            total_deleted = 0
            while True:
                sub = (
                    select(KeywordRanking.id)
                    .where(KeywordRanking.crawled_at < cutoff)
                    .limit(batch_size)
                )
                result = await db.execute(
                    delete(KeywordRanking).where(KeywordRanking.id.in_(sub))
                )
                deleted = result.rowcount
                await db.commit()
                total_deleted += deleted
                if deleted < batch_size:
                    break

            # crawl_logs 삭제
            logs_deleted = 0
            while True:
                sub = (
                    select(CrawlLog.id)
                    .where(CrawlLog.created_at < cutoff)
                    .limit(batch_size)
                )
                result = await db.execute(
                    delete(CrawlLog).where(CrawlLog.id.in_(sub))
                )
                deleted = result.rowcount
                await db.commit()
                logs_deleted += deleted
                if deleted < batch_size:
                    break

            if total_deleted or logs_deleted:
                logger.info(
                    f"데이터 정리 완료: rankings {total_deleted}건, logs {logs_deleted}건 삭제 "
                    f"(기준: {cutoff.isoformat()})"
                )
        except Exception as e:
            await db.rollback()
            logger.error(f"데이터 정리 실패: {e}")
