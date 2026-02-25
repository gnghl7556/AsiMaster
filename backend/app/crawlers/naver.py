import asyncio
import json
import logging
import random
import re
from collections import Counter
from urllib.parse import urlparse

import httpx

from app.core.config import settings
from app.crawlers.base import BaseCrawler, KeywordCrawlResult, RankingItem

logger = logging.getLogger(__name__)

_SMARTSTORE_HOSTS = {"smartstore.naver.com", "m.smartstore.naver.com", "brand.naver.com"}


async def _fetch_shipping_fee_once(
    client: httpx.AsyncClient, product_url: str,
) -> tuple[int, str]:
    """스마트스토어 상품 페이지에서 배송비 1회 시도.

    Returns:
        (fee, type) where type is "paid"|"free"|"unknown"|"error"
    """
    parsed = urlparse(product_url)
    if not parsed.hostname or parsed.hostname not in _SMARTSTORE_HOSTS:
        return 0, "unknown"

    try:
        resp = await client.get(product_url, headers={
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
            "Accept": "text/html",
        }, follow_redirects=True, timeout=8)

        if resp.status_code != 200:
            logger.warning(
                "배송비 스크래핑 HTTP 오류: url=%s status=%d",
                product_url, resp.status_code,
            )
            return 0, "error"

        html = resp.text

        # 오류 페이지 감지
        title_match = re.search(r"<title>([^<]*)</title>", html, re.IGNORECASE)
        if title_match and "에러" in title_match.group(1):
            logger.warning(
                "배송비 스크래핑 오류 페이지: url=%s final_url=%s",
                product_url, str(resp.url),
            )
            return 0, "error"

        match = re.search(r'__PRELOADED_STATE__\s*=\s*(\{.+?\})\s*</script>', html, re.DOTALL)
        if not match:
            logger.warning(
                "배송비 스크래핑 PRELOADED_STATE 미발견: url=%s final_url=%s",
                product_url, str(resp.url),
            )
            return 0, "error"

        data = json.loads(match.group(1))

        # 1차: simpleProductForDetailPage.{key}.productDeliveryInfo (2025~ 구조)
        simple_data = data.get("simpleProductForDetailPage", {})
        for key in simple_data:
            item = simple_data[key]
            if not isinstance(item, dict):
                continue
            delivery_info = item.get("productDeliveryInfo")
            if not isinstance(delivery_info, dict):
                continue
            fee_type = delivery_info.get("deliveryFeeType", "")
            if fee_type == "FREE":
                return 0, "free"
            base_fee = delivery_info.get("baseFee", 0)
            if base_fee:
                return int(base_fee), "paid"

        # 2차 폴백: product.{key}.channel.delivery (레거시 구조)
        product_data = data.get("product", {})
        for key in product_data:
            channel = product_data[key]
            if not isinstance(channel, dict):
                continue
            delivery = channel.get("channel", {}).get("delivery", {})
            if not delivery:
                delivery = channel.get("delivery", {})

            if delivery.get("FREE_DELIVERY") or delivery.get("freeDelivery"):
                return 0, "free"

            fee_info = delivery.get("deliveryFee", {})
            if isinstance(fee_info, dict):
                base_fee = fee_info.get("baseFee", 0)
                if base_fee:
                    return int(base_fee), "paid"

            if isinstance(delivery.get("deliveryFee"), (int, float)):
                return int(delivery["deliveryFee"]), "paid"

        # JSON 파싱 성공했으나 배송비 구조를 찾지 못함
        return 0, "error"
    except Exception as e:
        logger.warning("배송비 스크래핑 예외: url=%s error=%s", product_url, e)
        return 0, "error"


async def _fetch_shipping_fee(
    client: httpx.AsyncClient, product_url: str,
) -> tuple[int, str]:
    """배송비 추출 (error 시 1회 재시도).

    Returns:
        (fee, type) where type is "paid"|"free"|"unknown"|"error"
    """
    fee, fee_type = await _fetch_shipping_fee_once(client, product_url)
    if fee_type == "error":
        await asyncio.sleep(random.uniform(0.2, 0.4))
        fee, fee_type = await _fetch_shipping_fee_once(client, product_url)
    return fee, fee_type


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
        self._shipping_cache: dict[str, tuple[int, str]] = {}

    def clear_shipping_cache(self):
        self._shipping_cache.clear()

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

            # 스마트스토어 상품의 배송비 병렬 스크래핑 (캐시 적용)
            sem = asyncio.Semaphore(3)
            cache = self._shipping_cache

            async def _enrich_shipping(item: RankingItem) -> None:
                npid = item.naver_product_id
                if npid and npid in cache:
                    item.shipping_fee, item.shipping_fee_type = cache[npid]
                    return
                async with sem:
                    fee, fee_type = await _fetch_shipping_fee(self._client, item.product_url)
                    item.shipping_fee = fee
                    item.shipping_fee_type = fee_type
                    # paid/free만 캐시 저장 (error/unknown은 다음 키워드에서 재시도)
                    if npid and fee_type in ("paid", "free"):
                        cache[npid] = (fee, fee_type)

            await asyncio.gather(*[_enrich_shipping(item) for item in items])

            # 배송비 타입별 집계 로그
            type_counts = Counter(item.shipping_fee_type for item in items)
            logger.info(
                "키워드 '%s' → %d개 결과 (배송비: paid=%d free=%d unknown=%d error=%d)",
                keyword, len(items),
                type_counts.get("paid", 0), type_counts.get("free", 0),
                type_counts.get("unknown", 0), type_counts.get("error", 0),
            )
            return KeywordCrawlResult(keyword=keyword, items=items)

        except httpx.HTTPStatusError as e:
            logger.error(f"네이버 API 오류: {e.response.status_code} - {e.response.text}")
            return KeywordCrawlResult(keyword=keyword, success=False, error=f"네이버 API 오류: {e.response.status_code}")
        except Exception as e:
            logger.error(f"네이버 검색 실패: {e}")
            return KeywordCrawlResult(keyword=keyword, success=False, error=str(e))
