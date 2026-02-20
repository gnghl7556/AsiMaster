import logging
import re

import httpx

from app.core.config import settings
from app.crawlers.base import BaseCrawler, CrawlResult

logger = logging.getLogger(__name__)


def _strip_html(text: str) -> str:
    """네이버 API 응답의 HTML 태그(<b> 등) 제거."""
    return re.sub(r"<[^>]+>", "", text)


def _extract_keywords(product_name: str) -> list[str]:
    """상품명에서 2글자 이상 키워드만 추출."""
    words = re.split(r"[\s/·,]+", product_name)
    return [w.lower() for w in words if len(w) >= 2]


def _keyword_match_ratio(keywords: list[str], title: str) -> float:
    """키워드가 title에 포함되는 비율 (0.0 ~ 1.0)."""
    if not keywords:
        return 0.0
    title_lower = title.lower()
    matched = sum(1 for kw in keywords if kw in title_lower)
    return matched / len(keywords)


class NaverCrawler(BaseCrawler):
    platform_name = "naver"

    MATCH_THRESHOLD = 0.7  # 키워드 70% 이상 포함 시 매칭
    DISPLAY_COUNT = 10

    async def search(self, product_name: str) -> CrawlResult:
        if not settings.NAVER_CLIENT_ID or not settings.NAVER_CLIENT_SECRET:
            return CrawlResult(success=False, error="네이버 API 키가 설정되지 않았습니다")

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    "https://openapi.naver.com/v1/search/shop.json",
                    params={
                        "query": product_name,
                        "display": self.DISPLAY_COUNT,
                        "sort": "sim",
                    },
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

            # 중고/리퍼 제외 (productType: 1=일반, 2=중고, 3=리퍼)
            new_items = [
                item for item in items
                if str(item.get("productType", "1")) == "1"
            ]
            if not new_items:
                new_items = items  # 신품이 하나도 없으면 전체에서 선택

            # 키워드 매칭
            keywords = _extract_keywords(product_name)
            matched_items = []
            for item in new_items:
                title = _strip_html(item.get("title", ""))
                ratio = _keyword_match_ratio(keywords, title)
                if ratio >= self.MATCH_THRESHOLD:
                    matched_items.append(item)

            if matched_items:
                # 매칭된 결과 중 최저가 선택
                best = min(matched_items, key=lambda x: int(x["lprice"]))
                logger.info(
                    f"키워드 매칭 성공: '{product_name}' → "
                    f"'{_strip_html(best['title'])}' ({best['lprice']}원, "
                    f"{len(matched_items)}개 매칭)"
                )
            else:
                # fallback: 유사도 1위 사용
                best = new_items[0]
                logger.warning(
                    f"키워드 매칭 실패, fallback 사용: '{product_name}' → "
                    f"'{_strip_html(best['title'])}' ({best['lprice']}원)"
                )

            return CrawlResult(
                price=int(best["lprice"]),
                seller_name=best.get("mallName", ""),
                product_url=best.get("link", ""),
            )
        except httpx.HTTPStatusError as e:
            logger.error(f"네이버 API 오류: {e.response.status_code} - {e.response.text}")
            return CrawlResult(success=False, error=f"네이버 API 오류: {e.response.status_code}")
        except Exception as e:
            logger.error(f"네이버 검색 실패: {e}")
            return CrawlResult(success=False, error=str(e))
