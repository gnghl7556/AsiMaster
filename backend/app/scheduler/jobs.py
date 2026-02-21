import logging
from datetime import datetime, timedelta

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session
from app.crawlers.manager import CrawlManager
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
    async with async_session() as db:
        try:
            result = await db.execute(select(User))
            users = result.scalars().all()

            now = datetime.utcnow()
            manager = CrawlManager()
            for user in users:
                if user.crawl_interval_min <= 0:
                    continue

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
                try:
                    stats = await manager.crawl_user_all(db, user.id)
                    await db.commit()
                    logger.info(
                        f"크롤링 완료: {user.name} - "
                        f"총 {stats['total']}건, 성공 {stats['success']}건, 실패 {stats['failed']}건"
                    )
                except Exception as e:
                    await db.rollback()
                    logger.error(f"크롤링 실패: {user.name} - {e}")
        except Exception as e:
            logger.error(f"크롤링 작업 전체 실패: {e}")
