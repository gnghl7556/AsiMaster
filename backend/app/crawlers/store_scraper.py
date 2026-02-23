from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from urllib.parse import urlparse

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=15)
    return _client


async def close_client():
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
        _client = None


@dataclass
class StoreProduct:
    name: str
    price: int
    image_url: str
    category: str
    naver_product_id: str
    mall_name: str
    brand: str = ""
    maker: str = ""


@dataclass
class StoreInfo:
    channel_name: str
    channel_no: str


def suggest_keywords(
    product_name: str,
    store_name: str | None = None,
) -> list[str]:
    """상품명에서 검색 키워드 5개 자동 추출 (키워드 엔진 활용).

    DB 세션 없이 호출되므로 db_brands/db_types=None으로 분류기 사용.
    """
    from app.services.keyword_engine.classifier import classify_tokens
    from app.services.keyword_engine.generator import generate_keywords

    name = product_name.strip()

    # 스토어명 제거
    if store_name:
        for variant in [store_name, store_name.replace(" ", "")]:
            name = re.sub(re.escape(variant), "", name, flags=re.IGNORECASE).strip()

    # 키워드 엔진으로 분류 + 생성
    tokens = classify_tokens(name)
    generated = generate_keywords(tokens, max_count=5)

    result = [g.keyword for g in generated]

    # 5개 미만이면 전체 상품명(클린)으로 보충
    seen = {kw.lower() for kw in result}
    clean = name.strip()
    if len(result) < 5 and clean and clean.lower() not in seen:
        result.append(clean)

    return result[:5]


async def _get_store_info(store_slug: str) -> StoreInfo:
    """m.smartstore.naver.com에서 channelName, channelNo 추출."""
    url = f"https://m.smartstore.naver.com/{store_slug}"
    client = _get_client()
    resp = await client.get(url, headers={
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        "Accept": "text/html",
        "Accept-Language": "ko-KR,ko;q=0.9",
    }, follow_redirects=False)

    if resp.status_code >= 400:
        raise ValueError(f"스토어 페이지 접근 실패 (HTTP {resp.status_code})")

    html = resp.text

    # channelName 추출
    m = re.search(r'"channelName"\s*:\s*"([^"]+)"', html)
    if not m:
        raise ValueError("스토어 이름을 찾을 수 없습니다. URL을 확인해주세요.")
    channel_name = _sanitize_channel_name(m.group(1))
    if not channel_name:
        raise ValueError("스토어 이름이 비어있습니다.")

    # channelNo 추출
    channel_no = None
    for m2 in re.finditer(r'"channelNo"\s*:\s*"?(\d+)"?', html):
        v = m2.group(1)
        if v != "0" and len(v) > 3:
            channel_no = v
            break

    return StoreInfo(channel_name=channel_name, channel_no=channel_no or "")


ALLOWED_STORE_HOSTS = {
    "smartstore.naver.com",
    "m.smartstore.naver.com",
    "brand.naver.com",
}


_MAX_SLUG_LEN = 50
_DANGEROUS_CHARS = re.compile(r'[<>"\';&]')


def _sanitize_channel_name(name: str) -> str:
    """channel_name에서 위험 문자 제거 및 길이 제한."""
    name = _DANGEROUS_CHARS.sub("", name).strip()
    return name[:100]


def parse_store_slug(store_url: str) -> str:
    """스마트스토어 URL에서 slug 추출.

    지원 형식:
    - https://smartstore.naver.com/asmt
    - https://m.smartstore.naver.com/asmt
    - https://brand.naver.com/asmt
    - asmt (slug만 입력)
    """
    store_url = store_url.strip()

    # URL이 아닌 경우 slug로 간주
    if not store_url.startswith("http"):
        slug = store_url.split("/")[0]
        if not re.match(r'^[a-zA-Z0-9_-]+$', slug):
            raise ValueError("잘못된 스토어 slug입니다.")
        if len(slug) > _MAX_SLUG_LEN:
            raise ValueError(f"스토어 slug는 {_MAX_SLUG_LEN}자 이하여야 합니다.")
        return slug

    parsed = urlparse(store_url)
    if parsed.hostname not in ALLOWED_STORE_HOSTS:
        raise ValueError("허용되지 않는 도메인입니다. 스마트스토어 URL만 입력해주세요.")
    if parsed.scheme != "https":
        raise ValueError("HTTPS URL만 허용됩니다.")
    path = parsed.path.strip("/")
    if not path:
        raise ValueError("URL에서 스토어명을 찾을 수 없습니다.")

    slug = path.split("/")[0]
    if len(slug) > _MAX_SLUG_LEN:
        raise ValueError(f"스토어 slug는 {_MAX_SLUG_LEN}자 이하여야 합니다.")
    return slug


async def fetch_store_products(
    store_url: str,
    fallback_store_name: str | None = None,
) -> list[StoreProduct]:
    """스마트스토어 URL에서 상품 목록을 가져옴.

    1단계: 페이지 스크래핑으로 channelName(=mallName) 확보 (실패 시 fallback 사용)
    2단계: 네이버 쇼핑 API로 상품 검색 + mallName 필터
    """
    slug = parse_store_slug(store_url)
    logger.info(f"스토어 스크래핑 시작: {slug}")

    # 1단계: 스토어 정보 추출 (해외 IP에서 실패 가능 → fallback)
    channel_name = None
    try:
        store_info = await _get_store_info(slug)
        channel_name = store_info.channel_name
        logger.info(f"스토어 정보: channelName={channel_name}, channelNo={store_info.channel_no}")
    except ValueError as e:
        logger.warning(f"스토어 스크래핑 실패: {e}")
        if fallback_store_name:
            channel_name = fallback_store_name
            logger.info(f"fallback 스토어명 사용: {channel_name}")
        else:
            raise ValueError(
                "스토어 페이지 접근에 실패했습니다. "
                "설정에서 '네이버 스토어명'을 먼저 입력해주세요."
            )

    if not settings.NAVER_CLIENT_ID or not settings.NAVER_CLIENT_SECRET:
        raise ValueError("네이버 API 키가 설정되지 않았습니다.")

    # 2단계: 네이버 쇼핑 API로 상품 검색
    products: dict[str, StoreProduct] = {}

    client = _get_client()
    # 최대 1000개까지 (display=100, start 1~901)
    for start in range(1, 902, 100):
        resp = await client.get(
            "https://openapi.naver.com/v1/search/shop.json",
            params={
                "query": channel_name,
                "display": 100,
                "start": start,
                "sort": "date",
            },
            headers={
                "X-Naver-Client-Id": settings.NAVER_CLIENT_ID,
                "X-Naver-Client-Secret": settings.NAVER_CLIENT_SECRET,
            },
        )

        if resp.status_code != 200:
            logger.warning(f"쇼핑 API 오류: {resp.status_code}")
            break

        data = resp.json()
        items = data.get("items", [])
        if not items:
            break

        for item in items:
            mall = item.get("mallName", "")
            # mallName이 channelName과 일치하는 상품만 수집
            if mall != channel_name and channel_name not in mall and mall not in channel_name:
                continue

            pid = str(item.get("productId", ""))
            if not pid or pid in products:
                continue

            name = re.sub(r"<[^>]+>", "", item.get("title", ""))
            cat_parts = [
                item.get("category1", ""),
                item.get("category2", ""),
                item.get("category3", ""),
            ]
            category = "/".join(p for p in cat_parts if p)

            products[pid] = StoreProduct(
                name=name,
                price=int(item.get("lprice", 0)),
                image_url=item.get("image", ""),
                category=category,
                naver_product_id=pid,
                mall_name=mall,
                brand=item.get("brand", ""),
                maker=item.get("maker", ""),
            )

        total = data.get("total", 0)
        if start + 100 > total:
            break

    result = list(products.values())
    logger.info(f"스토어 '{channel_name}' 상품 {len(result)}개 수집 완료")
    return result
