import logging
import re

import httpx

from app.core.config import settings
from app.crawlers.base import BaseCrawler, KeywordCrawlResult, RankingItem

logger = logging.getLogger(__name__)


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text)


class NaverCrawler(BaseCrawler):
    platform_name = "naver"
    MAX_RESULTS = 10

    def __init__(self):
        self._client = httpx.AsyncClient(
            timeout=10,
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
        )

    async def close(self):
        await self._client.aclose()

    async def search_keyword(self, keyword: str) -> KeywordCrawlResult:
        if not settings.NAVER_CLIENT_ID or not settings.NAVER_CLIENT_SECRET:
            return KeywordCrawlResult(keyword=keyword, success=False, error="네이버 API 키가 설정되지 않았습니다")

        try:
            resp = await self._client.get(
                "https://openapi.naver.com/v1/search/shop.json",
                params={
                    "query": keyword,
                    "display": self.MAX_RESULTS,
                    "sort": "sim",
                },
                headers={
                    "X-Naver-Client-Id": settings.NAVER_CLIENT_ID,
                    "X-Naver-Client-Secret": settings.NAVER_CLIENT_SECRET,
                },
            )
            resp.raise_for_status()

            data = resp.json()
            raw_items = data.get("items", [])
            if not raw_items:
                return KeywordCrawlResult(keyword=keyword, success=False, error=f"검색 결과 없음: {keyword}")

            # 중고/리퍼 제외 (productType: 1=일반)
            new_items = [
                item for item in raw_items
                if str(item.get("productType", "1")) == "1"
            ]
            if not new_items:
                new_items = raw_items

            items = []
            for idx, item in enumerate(new_items[:self.MAX_RESULTS], start=1):
                items.append(RankingItem(
                    rank=idx,
                    product_name=_strip_html(item.get("title", "")),
                    price=int(item.get("lprice", 0)),
                    mall_name=item.get("mallName", ""),
                    product_url=item.get("link", ""),
                    image_url=item.get("image", ""),
                    naver_product_id=str(item.get("productId", "")),
                ))

            logger.info(f"키워드 검색 완료: '{keyword}' → {len(items)}개 결과")
            return KeywordCrawlResult(keyword=keyword, items=items)

        except httpx.HTTPStatusError as e:
            logger.error(f"네이버 API 오류: {e.response.status_code} - {e.response.text}")
            return KeywordCrawlResult(keyword=keyword, success=False, error=f"네이버 API 오류: {e.response.status_code}")
        except Exception as e:
            logger.error(f"네이버 검색 실패: {e}")
            return KeywordCrawlResult(keyword=keyword, success=False, error=str(e))
