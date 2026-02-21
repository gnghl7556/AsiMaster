import asyncio
import logging
import random
import time
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.crawlers.base import KeywordCrawlResult
from app.crawlers.naver import NaverCrawler
from app.models.crawl_log import CrawlLog
from app.models.keyword_ranking import KeywordRanking
from app.models.product import Product
from app.models.search_keyword import SearchKeyword
from app.models.user import User
from app.services.alert_service import check_and_create_alerts

logger = logging.getLogger(__name__)

crawler = NaverCrawler()


class CrawlManager:
    async def crawl_keyword(
        self, db: AsyncSession, keyword: SearchKeyword, naver_store_name: str | None
    ) -> KeywordCrawlResult:
        max_retries = settings.CRAWL_MAX_RETRIES
        start_time = time.time()
        result = None

        for attempt in range(1, max_retries + 1):
            result = await crawler.search_keyword(keyword.keyword)
            if result.success:
                break
            if attempt < max_retries:
                delay = random.uniform(
                    settings.CRAWL_REQUEST_DELAY_MIN,
                    settings.CRAWL_REQUEST_DELAY_MAX,
                )
                logger.warning(
                    f"크롤링 재시도 {attempt}/{max_retries}: "
                    f"'{keyword.keyword}' ({delay:.1f}s 대기)"
                )
                await asyncio.sleep(delay)

        duration_ms = int((time.time() - start_time) * 1000)

        # 크롤링 로그
        log = CrawlLog(
            keyword_id=keyword.id,
            status="success" if result.success else "failed",
            error_message=result.error,
            duration_ms=duration_ms,
        )
        db.add(log)

        if result.success and result.items:
            for item in result.items:
                is_my = (
                    bool(naver_store_name)
                    and item.mall_name.strip().lower() == naver_store_name.strip().lower()
                )
                ranking = KeywordRanking(
                    keyword_id=keyword.id,
                    rank=item.rank,
                    product_name=item.product_name,
                    price=item.price,
                    mall_name=item.mall_name,
                    product_url=item.product_url,
                    image_url=item.image_url,
                    is_my_store=is_my,
                )
                db.add(ranking)

            keyword.last_crawled_at = datetime.utcnow()
            keyword.crawl_status = "success"
        else:
            keyword.crawl_status = "failed"

        await db.flush()
        return result

    async def crawl_product(self, db: AsyncSession, product_id: int) -> list[KeywordCrawlResult]:
        product = await db.get(Product, product_id)
        if not product:
            return []

        user = await db.get(User, product.user_id)
        naver_store_name = user.naver_store_name if user else None

        result = await db.execute(
            select(SearchKeyword).where(
                SearchKeyword.product_id == product_id,
                SearchKeyword.is_active == True,
            )
        )
        keywords = result.scalars().all()

        results = []
        for idx, kw in enumerate(keywords):
            if idx > 0:
                delay = random.uniform(
                    settings.CRAWL_REQUEST_DELAY_MIN,
                    settings.CRAWL_REQUEST_DELAY_MAX,
                )
                await asyncio.sleep(delay)
            r = await self.crawl_keyword(db, kw, naver_store_name)
            results.append(r)

        # 알림 체크
        if results:
            await check_and_create_alerts(db, product, keywords, naver_store_name)

        return results

    async def crawl_user_all(self, db: AsyncSession, user_id: int) -> dict:
        result = await db.execute(
            select(Product).where(Product.user_id == user_id, Product.is_active == True)
        )
        products = result.scalars().all()

        total = 0
        success = 0
        failed = 0

        for product in products:
            product_results = await self.crawl_product(db, product.id)
            for r in product_results:
                total += 1
                if r.success:
                    success += 1
                else:
                    failed += 1

        return {"total": total, "success": success, "failed": failed}
