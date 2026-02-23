import asyncio
import json
import logging
import re
from urllib.parse import urlparse

import httpx

from app.core.config import settings
from app.crawlers.base import BaseCrawler, KeywordCrawlResult, RankingItem

logger = logging.getLogger(__name__)

_SMARTSTORE_HOSTS = {"smartstore.naver.com", "m.smartstore.naver.com", "brand.naver.com"}


async def _fetch_shipping_fee(client: httpx.AsyncClient, product_url: str) -> int:
    """스마트스토어 상품 페이지에서 배송비 추출.

    비스마트스토어이거나 스크래핑 실패 시 0 반환.
    """
    try:
        parsed = urlparse(product_url)
        if not parsed.hostname or parsed.hostname not in _SMARTSTORE_HOSTS:
            return 0

        resp = await client.get(product_url, headers={
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
            "Accept": "text/html",
        }, follow_redirects=True, timeout=8)

        if resp.status_code != 200:
            return 0

        html = resp.text

        match = re.search(r'__PRELOADED_STATE__\s*=\s*({.+?})\s*</script>', html, re.DOTALL)
        if not match:
            return 0

        data = json.loads(match.group(1))

        product_data = data.get("product", {})
        for key in product_data:
            channel = product_data[key]
            if not isinstance(channel, dict):
                continue
            delivery = channel.get("channel", {}).get("delivery", {})
            if not delivery:
                delivery = channel.get("delivery", {})

            if delivery.get("FREE_DELIVERY") or delivery.get("freeDelivery"):
                return 0

            fee_info = delivery.get("deliveryFee", {})
            if isinstance(fee_info, dict):
                base_fee = fee_info.get("baseFee", 0)
                if base_fee:
                    return int(base_fee)

            if isinstance(delivery.get("deliveryFee"), (int, float)):
                return int(delivery["deliveryFee"])

        return 0
    except Exception:
        return 0


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

    async def search_keyword(self, keyword: str, sort_type: str = "sim") -> KeywordCrawlResult:
        if not settings.NAVER_CLIENT_ID or not settings.NAVER_CLIENT_SECRET:
            return KeywordCrawlResult(keyword=keyword, success=False, error="네이버 API 키가 설정되지 않았습니다")

        try:
            resp = await self._client.get(
                "https://openapi.naver.com/v1/search/shop.json",
                params={
                    "query": keyword,
                    "display": self.MAX_RESULTS,
                    "sort": sort_type,
                    "exclude": "used:rental:cbshop",
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

            items = []
            for idx, item in enumerate(raw_items[:self.MAX_RESULTS], start=1):
                items.append(RankingItem(
                    rank=idx,
                    product_name=_strip_html(item.get("title", "")),
                    price=int(item.get("lprice", 0)),
                    mall_name=item.get("mallName", ""),
                    product_url=item.get("link", ""),
                    image_url=item.get("image", ""),
                    naver_product_id=str(item.get("productId", "")),
                    hprice=int(item.get("hprice", 0) or 0),
                    brand=item.get("brand", ""),
                    maker=item.get("maker", ""),
                    product_type=str(item.get("productType", "")),
                    category1=item.get("category1", ""),
                    category2=item.get("category2", ""),
                    category3=item.get("category3", ""),
                    category4=item.get("category4", ""),
                ))

            # 스마트스토어 상품의 배송비 병렬 스크래핑
            sem = asyncio.Semaphore(3)

            async def _enrich_shipping(item: RankingItem) -> None:
                async with sem:
                    item.shipping_fee = await _fetch_shipping_fee(self._client, item.product_url)

            await asyncio.gather(*[_enrich_shipping(item) for item in items])

            logger.info(f"키워드 검색 완료: '{keyword}' → {len(items)}개 결과")
            return KeywordCrawlResult(keyword=keyword, items=items)

        except httpx.HTTPStatusError as e:
            logger.error(f"네이버 API 오류: {e.response.status_code} - {e.response.text}")
            return KeywordCrawlResult(keyword=keyword, success=False, error=f"네이버 API 오류: {e.response.status_code}")
        except Exception as e:
            logger.error(f"네이버 검색 실패: {e}")
            return KeywordCrawlResult(keyword=keyword, success=False, error=str(e))
