import asyncio
import logging
import random
import time
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.crawlers.base import KeywordCrawlResult, RankingItem
from app.crawlers.naver import NaverCrawler
from app.models.crawl_log import CrawlLog
from app.models.excluded_product import ExcludedProduct
from app.models.included_override import IncludedOverride
from app.models.keyword_ranking import KeywordRanking
from app.models.product import Product
from app.models.search_keyword import SearchKeyword
from app.models.user import User
from app.core.utils import utcnow
from app.services.alert_service import check_and_create_alerts

logger = logging.getLogger(__name__)

crawler = NaverCrawler()


class CrawlAlreadyRunningError(Exception):
    """크롤링이 이미 진행 중일 때 발생."""
    pass


def _check_relevance(item: RankingItem, product: Product | None) -> tuple[bool, str | None]:
    """모델코드 + 규격 키워드 + 가격 범위 기반 관련성 판별.

    Returns: (is_relevant, reason)
        reason은 제외 사유. relevant이면 None.
    """
    if not product:
        return True, None

    # 가격 범위 필터 (배송비 포함 총액 기준)
    total_price = item.price + item.shipping_fee
    if product.price_filter_min_pct is not None and product.selling_price > 0:
        min_price = product.selling_price * product.price_filter_min_pct / 100
        if total_price < min_price:
            return False, "price_filter_min"
    if product.price_filter_max_pct is not None and product.selling_price > 0:
        max_price = product.selling_price * product.price_filter_max_pct / 100
        if total_price > max_price:
            return False, "price_filter_max"

    # 모델코드 + 규격 키워드 필터
    if not product.model_code:
        return True, None
    title_lower = item.product_name.lower()
    if product.model_code.lower() not in title_lower:
        return False, "model_code"
    if product.spec_keywords:
        for spec in product.spec_keywords:
            if spec.lower() not in title_lower:
                return False, "spec_keywords"
    return True, None


class CrawlManager:

    def __init__(self):
        self._user_locks: dict[int, asyncio.Lock] = {}
        self._product_locks: dict[int, asyncio.Lock] = {}

    def _get_user_lock(self, user_id: int) -> asyncio.Lock:
        if user_id not in self._user_locks:
            self._user_locks[user_id] = asyncio.Lock()
        return self._user_locks[user_id]

    def _get_product_lock(self, product_id: int) -> asyncio.Lock:
        if product_id not in self._product_locks:
            self._product_locks[product_id] = asyncio.Lock()
        return self._product_locks[product_id]

    def is_user_crawling(self, user_id: int) -> bool:
        lock = self._user_locks.get(user_id)
        return lock.locked() if lock else False

    def is_product_crawling(self, product_id: int) -> bool:
        lock = self._product_locks.get(product_id)
        return lock.locked() if lock else False

    async def _fetch_keyword(self, keyword_str: str, sort_type: str = "sim") -> KeywordCrawlResult:
        """네이버 API 호출만 수행 (DB 접근 없음, 병렬 안전)."""
        max_retries = settings.CRAWL_MAX_RETRIES
        result = None
        for attempt in range(1, max_retries + 1):
            result = await crawler.search_keyword(keyword_str, sort_type=sort_type)
            if result.success:
                break
            if attempt < max_retries:
                delay = random.uniform(
                    settings.CRAWL_REQUEST_DELAY_MIN,
                    settings.CRAWL_REQUEST_DELAY_MAX,
                )
                logger.warning(
                    f"크롤링 재시도 {attempt}/{max_retries}: "
                    f"'{keyword_str}' ({delay:.1f}s 대기)"
                )
                await asyncio.sleep(delay)
        return result

    async def _save_keyword_result(
        self,
        db: AsyncSession,
        keyword: SearchKeyword,
        result: KeywordCrawlResult,
        naver_store_name: str | None,
        duration_ms: int,
        product: Product | None = None,
        excluded_ids: set[str] | None = None,
        my_product_ids: set[str] | None = None,
        included_override_ids: set[str] | None = None,
    ) -> None:
        """크롤링 결과를 DB에 저장 (순차 호출)."""
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

                # is_relevant 판정 우선순위:
                # 1) 수동 블랙리스트 → False (최우선)
                # 2) 내 상품 → False
                # 3) 수동 포함 예외(included_override) → True (자동 필터 우회)
                # 4) 자동 필터(_check_relevance) → True/False
                is_blacklisted = (
                    excluded_ids and item.naver_product_id in excluded_ids
                )
                is_my_product = (
                    my_product_ids
                    and item.naver_product_id
                    and item.naver_product_id in my_product_ids
                )
                is_override = (
                    included_override_ids
                    and item.naver_product_id
                    and item.naver_product_id in included_override_ids
                )

                if is_blacklisted:
                    is_relevant = False
                    relevance_reason = "manual_blacklist"
                elif is_my_product:
                    is_relevant = False
                    relevance_reason = "my_product"
                elif is_override:
                    is_relevant = True
                    relevance_reason = "included_override"
                else:
                    is_relevant, relevance_reason = _check_relevance(item, product)

                # 내 상품의 최신 판매가 자동 갱신
                if is_my_product and product and item.price > 0:
                    if product.selling_price != item.price:
                        logger.info(
                            "판매가 자동 갱신: product_id=%d '%s' %d → %d",
                            product.id, product.name, product.selling_price, item.price,
                        )
                        product.selling_price = item.price

                ranking = KeywordRanking(
                    keyword_id=keyword.id,
                    rank=item.rank,
                    product_name=item.product_name,
                    price=item.price,
                    mall_name=item.mall_name,
                    product_url=item.product_url,
                    image_url=item.image_url,
                    naver_product_id=item.naver_product_id,
                    is_my_store=is_my,
                    is_relevant=is_relevant,
                    relevance_reason=relevance_reason,
                    hprice=item.hprice,
                    brand=item.brand,
                    maker=item.maker,
                    product_type=item.product_type,
                    category1=item.category1,
                    category2=item.category2,
                    category3=item.category3,
                    category4=item.category4,
                    shipping_fee=item.shipping_fee,
                    shipping_fee_type=item.shipping_fee_type,
                )
                db.add(ranking)

            keyword.last_crawled_at = utcnow()
            keyword.crawl_status = "success"
        else:
            keyword.crawl_status = "failed"

        await db.flush()

    async def crawl_product(self, db: AsyncSession, product_id: int) -> list[KeywordCrawlResult]:
        """단일 상품 크롤링 (API 수동 호출용). 키워드 병렬 처리."""
        lock = self._get_product_lock(product_id)
        if lock.locked():
            raise CrawlAlreadyRunningError(f"상품 {product_id} 크롤링이 이미 진행 중입니다.")
        async with lock:
            return await self._crawl_product_impl(db, product_id)

    async def _crawl_product_impl(self, db: AsyncSession, product_id: int) -> list[KeywordCrawlResult]:
        crawler.clear_shipping_cache()
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
        if not keywords:
            return []

        # 블랙리스트 조회
        excluded_result = await db.execute(
            select(ExcludedProduct).where(ExcludedProduct.product_id == product_id)
        )
        excluded_rows = excluded_result.scalars().all()
        excluded_ids = {ep.naver_product_id for ep in excluded_rows}

        # 수동 포함 예외 조회
        included_result = await db.execute(
            select(IncludedOverride).where(IncludedOverride.product_id == product_id)
        )
        included_override_ids = {io.naver_product_id for io in included_result.scalars().all()}

        # 유저의 모든 등록 상품 naver_product_id 수집 (내 스토어 다른 제품 제외용)
        all_products_result = await db.execute(
            select(Product.naver_product_id).where(
                Product.user_id == product.user_id,
                Product.is_active == True,
                Product.naver_product_id.isnot(None),
            )
        )
        my_product_ids = {pid for pid in all_products_result.scalars().all() if pid}

        # 병렬 API 호출
        sem = asyncio.Semaphore(settings.CRAWL_CONCURRENCY)

        async def _fetch_one(kw: SearchKeyword):
            async with sem:
                delay = random.uniform(
                    settings.CRAWL_REQUEST_DELAY_MIN,
                    settings.CRAWL_REQUEST_DELAY_MAX,
                )
                await asyncio.sleep(delay)
                start = time.time()
                r = await self._fetch_keyword(kw.keyword, sort_type=kw.sort_type or "sim")
                ms = int((time.time() - start) * 1000)
                return kw, r, ms

        fetch_results = await asyncio.gather(*[_fetch_one(kw) for kw in keywords])

        # 순차 DB 기록
        results = []
        for kw, crawl_result, duration_ms in fetch_results:
            try:
                await self._save_keyword_result(
                    db, kw, crawl_result, naver_store_name, duration_ms,
                    product=product, excluded_ids=excluded_ids,
                    my_product_ids=my_product_ids,
                    included_override_ids=included_override_ids,
                )
            except Exception as e:
                logger.error(f"키워드 '{kw.keyword}' 저장 실패: {e}")
            results.append(crawl_result)

        # 알림 체크
        if results:
            await check_and_create_alerts(db, product, keywords, naver_store_name)

        return results

    async def crawl_user_all(self, db: AsyncSession, user_id: int) -> dict:
        """유저 전체 크롤링. 키워드 중복 제거 + 병렬 처리."""
        lock = self._get_user_lock(user_id)
        if lock.locked():
            raise CrawlAlreadyRunningError(f"유저 {user_id} 크롤링이 이미 진행 중입니다.")
        async with lock:
            return await self._crawl_user_all_impl(db, user_id)

    async def _crawl_user_all_impl(self, db: AsyncSession, user_id: int) -> dict:
        crawler.clear_shipping_cache()
        user = await db.get(User, user_id)
        if not user:
            return {"total": 0, "success": 0, "failed": 0}
        naver_store_name = user.naver_store_name

        # 1. 전체 활성 키워드 수집
        kw_result = await db.execute(
            select(SearchKeyword)
            .join(Product, SearchKeyword.product_id == Product.id)
            .where(
                Product.user_id == user_id,
                Product.is_active == True,
                SearchKeyword.is_active == True,
            )
        )
        all_keywords = kw_result.scalars().all()
        if not all_keywords:
            return {"total": 0, "success": 0, "failed": 0}

        # 상품별 블랙리스트 조회 (배치 쿼리)
        product_ids = {kw.product_id for kw in all_keywords}
        excluded_ids_by_product: dict[int, set[str]] = {pid: set() for pid in product_ids}
        ex_result = await db.execute(
            select(ExcludedProduct).where(ExcludedProduct.product_id.in_(product_ids))
        )
        for ep in ex_result.scalars().all():
            excluded_ids_by_product[ep.product_id].add(ep.naver_product_id)

        # 상품별 수동 포함 예외 조회 (배치 쿼리)
        included_ids_by_product: dict[int, set[str]] = {pid: set() for pid in product_ids}
        inc_result = await db.execute(
            select(IncludedOverride).where(IncludedOverride.product_id.in_(product_ids))
        )
        for io in inc_result.scalars().all():
            included_ids_by_product[io.product_id].add(io.naver_product_id)

        # 상품 객체 캐시 (배치 쿼리)
        prod_result = await db.execute(
            select(Product).where(Product.id.in_(product_ids))
        )
        products_cache: dict[int, Product] = {p.id: p for p in prod_result.scalars().all()}

        # 유저의 모든 등록 상품 naver_product_id 수집 (내 스토어 다른 제품 제외용)
        all_products_result = await db.execute(
            select(Product.naver_product_id).where(
                Product.user_id == user_id,
                Product.is_active == True,
                Product.naver_product_id.isnot(None),
            )
        )
        my_product_ids = {pid for pid in all_products_result.scalars().all() if pid}

        # 2. 키워드 문자열+정렬유형 기준 중복 제거
        unique_map: dict[tuple[str, str], list[SearchKeyword]] = {}
        for kw in all_keywords:
            key = (kw.keyword.strip().lower(), kw.sort_type or "sim")
            unique_map.setdefault(key, []).append(kw)

        # 3. 유니크 키워드만 병렬 크롤링
        sem = asyncio.Semaphore(settings.CRAWL_CONCURRENCY)

        async def _fetch_one(keyword_str: str, sort_type: str):
            async with sem:
                delay = random.uniform(
                    settings.CRAWL_REQUEST_DELAY_MIN,
                    settings.CRAWL_REQUEST_DELAY_MAX,
                )
                await asyncio.sleep(delay)
                start = time.time()
                r = await self._fetch_keyword(keyword_str, sort_type=sort_type)
                ms = int((time.time() - start) * 1000)
                return keyword_str, sort_type, r, ms

        fetch_results = await asyncio.gather(
            *[_fetch_one(kw_str, st) for (kw_str, st) in unique_map.keys()]
        )

        # 4. 결과를 각 SearchKeyword에 순차적으로 DB 기록
        total = 0
        success = 0
        failed = 0

        for kw_str, sort_type, crawl_result, duration_ms in fetch_results:
            for kw in unique_map[(kw_str, sort_type)]:
                product = products_cache.get(kw.product_id)
                excluded_ids = excluded_ids_by_product.get(kw.product_id, set())
                included_ids = included_ids_by_product.get(kw.product_id, set())
                try:
                    await self._save_keyword_result(
                        db, kw, crawl_result, naver_store_name, duration_ms,
                        product=product, excluded_ids=excluded_ids,
                        my_product_ids=my_product_ids,
                        included_override_ids=included_ids,
                    )
                except Exception as e:
                    logger.error(f"키워드 '{kw.keyword}' 저장 실패: {e}")
                total += 1
                if crawl_result.success:
                    success += 1
                else:
                    failed += 1

        # 5. 알림 체크 (상품별)
        for pid in product_ids:
            product = products_cache.get(pid)
            product_keywords = [kw for kw in all_keywords if kw.product_id == pid]
            if product and product_keywords:
                await check_and_create_alerts(db, product, product_keywords, naver_store_name)

        return {"total": total, "success": success, "failed": failed}


shared_manager = CrawlManager()
