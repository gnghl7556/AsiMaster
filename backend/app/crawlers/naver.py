import logging

import httpx

from app.core.config import settings
from app.crawlers.base import BaseCrawler, CrawlResult

logger = logging.getLogger(__name__)


class NaverCrawler(BaseCrawler):
    platform_name = "naver"

    async def search(self, product_name: str) -> CrawlResult:
        if not settings.NAVER_CLIENT_ID or not settings.NAVER_CLIENT_SECRET:
            return CrawlResult(success=False, error="네이버 API 키가 설정되지 않았습니다")

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    "https://openapi.naver.com/v1/search/shop.json",
                    params={"query": product_name, "display": 1, "sort": "asc"},
                    headers={
                        "X-Naver-Client-Id": settings.NAVER_CLIENT_ID,
                        "X-Naver-Client-Secret": settings.NAVER_CLIENT_SECRET,
                    },
                )
                resp.raise_for_status()

            data = resp.json()
            items = data.get("items", [])
            if not items:
                return CrawlResult(success=False, error=f"검색 결과 없음: {product_name}")

            item = items[0]
            return CrawlResult(
                price=int(item["lprice"]),
                seller_name=item.get("mallName", ""),
                product_url=item.get("link", ""),
            )
        except httpx.HTTPStatusError as e:
            logger.error(f"네이버 API 오류: {e.response.status_code} - {e.response.text}")
            return CrawlResult(success=False, error=f"네이버 API 오류: {e.response.status_code}")
        except Exception as e:
            logger.error(f"네이버 검색 실패: {e}")
            return CrawlResult(success=False, error=str(e))
