import logging

from app.core.database import async_session
from app.crawlers.manager import CrawlManager
from app.models.user import User
from sqlalchemy import select

logger = logging.getLogger(__name__)


async def crawl_all_users():
    """모든 사업체의 활성 상품을 크롤링"""
    async with async_session() as db:
        try:
            result = await db.execute(select(User))
            users = result.scalars().all()

            manager = CrawlManager()
            for user in users:
                logger.info(f"크롤링 시작: {user.name} (ID: {user.id})")
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
