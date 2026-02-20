import time
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crawlers.base import CrawlResult
from app.crawlers.registry import CrawlerRegistry
from app.models.competitor import Competitor
from app.models.crawl_log import CrawlLog
from app.models.platform import Platform
from app.models.price_history import PriceHistory
from app.models.product import Product
from app.services.alert_service import check_and_create_alerts


class CrawlManager:
    async def crawl_competitor(self, db: AsyncSession, competitor: Competitor) -> CrawlResult:
        platform = await db.get(Platform, competitor.platform_id)
        if not platform:
            return CrawlResult(success=False, error="플랫폼 없음")

        crawler = CrawlerRegistry.get(platform.name)
        if not crawler:
            return CrawlResult(success=False, error=f"크롤러 없음: {platform.name}")

        # 상품명으로 검색
        product = await db.get(Product, competitor.product_id)
        if not product:
            return CrawlResult(success=False, error="상품 없음")

        start_time = time.time()
        result = await crawler.search(product.name)
        duration_ms = int((time.time() - start_time) * 1000)

        # 크롤링 로그 기록
        log = CrawlLog(
            competitor_id=competitor.id,
            platform_id=competitor.platform_id,
            status="success" if result.success else "failed",
            error_message=result.error,
            duration_ms=duration_ms,
        )
        db.add(log)

        if result.success and result.price is not None:
            # 가격 이력 저장
            total_price = result.price + result.shipping_fee
            history = PriceHistory(
                competitor_id=competitor.id,
                price=result.price,
                shipping_fee=result.shipping_fee,
                total_price=total_price,
                ranking=result.ranking,
                total_sellers=result.total_sellers,
            )
            db.add(history)

            # 경쟁사 상태 업데이트
            competitor.last_crawled_at = datetime.now(timezone.utc)
            competitor.crawl_status = "success"
            if result.seller_name:
                competitor.seller_name = result.seller_name

            # 알림 체크
            await check_and_create_alerts(db, product, competitor, total_price)
        else:
            competitor.crawl_status = "failed"

        await db.flush()
        return result

    async def crawl_product(self, db: AsyncSession, product_id: int) -> list[CrawlResult]:
        result = await db.execute(
            select(Competitor).where(
                Competitor.product_id == product_id,
                Competitor.is_active == True,
            )
        )
        competitors = result.scalars().all()
        results = []
        for comp in competitors:
            r = await self.crawl_competitor(db, comp)
            results.append(r)
        return results

    async def crawl_user_all(self, db: AsyncSession, user_id: int) -> dict:
        result = await db.execute(
            select(Product).where(Product.user_id == user_id, Product.is_active == True)
        )
        products = result.scalars().all()

        total = 0
        success = 0
        failed = 0
        all_results = []

        for product in products:
            product_results = await self.crawl_product(db, product.id)
            for r in product_results:
                total += 1
                if r.success:
                    success += 1
                else:
                    failed += 1
            all_results.extend(product_results)

        return {"total": total, "success": success, "failed": failed, "results": all_results}
