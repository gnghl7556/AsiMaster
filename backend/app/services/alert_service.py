"""알림 자동 생성 서비스 (크롤링 후 호출)"""

import logging
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.alert import Alert, AlertSetting
from app.models.excluded_product import ExcludedProduct
from app.models.keyword_ranking import KeywordRanking
from app.models.product import Product
from app.models.search_keyword import SearchKeyword
from app.services.product_service import _fetch_latest_rankings
from app.services.push_service import send_push_to_user
from app.services.telegram_service import send_telegram_to_user
from app.core.utils import utcnow

logger = logging.getLogger(__name__)


async def _batch_prefetch(
    db: AsyncSession, user_id: int, product: Product, keywords: list[SearchKeyword],
) -> dict:
    """알림 체크에 필요한 데이터를 배치 쿼리로 한꺼번에 조회."""
    keyword_ids = [kw.id for kw in keywords]
    now = utcnow()
    dedup_since = now - timedelta(hours=settings.ALERT_DEDUP_HOURS)

    # 1) 알림 설정 2건 한 번에 조회
    settings_result = await db.execute(
        select(AlertSetting).where(
            AlertSetting.user_id == user_id,
            AlertSetting.alert_type.in_(["price_undercut", "rank_drop"]),
        )
    )
    alert_settings: dict[str, AlertSetting] = {}
    for s in settings_result.scalars().all():
        alert_settings[s.alert_type] = s

    # 2) 최근 미읽음 알림 2건 한 번에 조회 (중복 방지)
    recent_alerts_result = await db.execute(
        select(Alert.type).where(
            Alert.user_id == user_id,
            Alert.product_id == product.id,
            Alert.type.in_(["price_undercut", "rank_drop"]),
            Alert.is_read == False,
            Alert.created_at > dedup_since,
        )
    )
    recent_alert_types = set(recent_alerts_result.scalars().all())

    # 3) 블랙리스트 조회
    ex_result = await db.execute(
        select(ExcludedProduct).where(ExcludedProduct.product_id == product.id)
    )
    excluded_ids = {ep.naver_product_id for ep in ex_result.scalars().all()}

    # 4) 최신 rankings 조회 (keyword_ids 일괄)
    latest_by_kw = await _fetch_latest_rankings(db, keyword_ids) if keyword_ids else {}

    return {
        "keyword_ids": keyword_ids,
        "alert_settings": alert_settings,
        "recent_alert_types": recent_alert_types,
        "excluded_ids": excluded_ids,
        "latest_by_kw": latest_by_kw,
    }


def _is_alert_enabled_from_cache(
    alert_settings: dict[str, AlertSetting], alert_type: str,
) -> tuple[bool, float | None]:
    setting = alert_settings.get(alert_type)
    if setting is None:
        return True, None
    return setting.is_enabled, float(setting.threshold) if setting.threshold else None


async def _check_price_undercut(
    db: AsyncSession, product: Product, keywords: list[SearchKeyword],
    prefetched: dict,
):
    """최저가 이탈: 전체 키워드 결과 최저가 < 내 판매가."""
    enabled, _ = _is_alert_enabled_from_cache(prefetched["alert_settings"], "price_undercut")
    if not enabled:
        return

    keyword_ids = prefetched["keyword_ids"]
    if not keyword_ids:
        return

    excluded_ids = prefetched["excluded_ids"]
    latest_by_kw = prefetched["latest_by_kw"]

    # 최신 크롤링 rankings 중 relevant + 블랙리스트 제외
    all_latest: list[KeywordRanking] = []
    for kw_id in keyword_ids:
        for r in latest_by_kw.get(kw_id, []):
            if not r.is_relevant:
                continue
            if r.naver_product_id and r.naver_product_id in excluded_ids:
                continue
            all_latest.append(r)

    if not all_latest:
        return

    lowest = min(all_latest, key=lambda r: r.price + (r.shipping_fee or 0))
    lowest_total = lowest.price + (lowest.shipping_fee or 0)
    if lowest_total >= product.selling_price:
        return

    gap = product.selling_price - lowest_total
    gap_percent = (gap / product.selling_price) * 100 if product.selling_price > 0 else 0

    if "price_undercut" in prefetched["recent_alert_types"]:
        return

    title = f"{product.name} - 최저가 이탈"
    message = f"{lowest.mall_name} {lowest_total:,}원 (내 가격 대비 -{gap:,}원, -{gap_percent:.1f}%)"
    alert = Alert(
        user_id=product.user_id,
        product_id=product.id,
        type="price_undercut",
        title=title,
        message=message,
        data={
            "keyword": lowest.keyword.keyword if hasattr(lowest, 'keyword') and lowest.keyword else "",
            "my_price": product.selling_price,
            "competitor_price": lowest_total,
            "competitor_name": lowest.mall_name,
            "gap": gap,
            "gap_percent": round(gap_percent, 1),
        },
    )
    db.add(alert)
    await send_push_to_user(db, product.user_id, title, message, {"type": "price_undercut", "product_id": product.id})
    await send_telegram_to_user(db, product.user_id, title, message, alert_type="price_undercut")


async def _check_rank_drop(
    db: AsyncSession, product: Product, keywords: list[SearchKeyword],
    naver_store_name: str | None, prefetched: dict,
):
    """내 순위 하락 감지."""
    if not naver_store_name:
        return

    enabled, threshold = _is_alert_enabled_from_cache(prefetched["alert_settings"], "rank_drop")
    if not enabled:
        return

    keyword_ids = prefetched["keyword_ids"]
    if not keyword_ids:
        return

    # 최근 7일 내 내 상품 rankings만 조회
    since = utcnow() - timedelta(days=settings.SPARKLINE_DAYS)
    if product.naver_product_id:
        my_filter = KeywordRanking.naver_product_id == product.naver_product_id
    else:
        my_filter = KeywordRanking.is_my_store == True
    result = await db.execute(
        select(KeywordRanking)
        .where(
            KeywordRanking.keyword_id.in_(keyword_ids),
            my_filter,
            KeywordRanking.crawled_at >= since,
        )
        .order_by(KeywordRanking.crawled_at.desc())
    )
    all_my_rankings = result.scalars().all()

    # 키워드별 그룹핑
    by_keyword: dict[int, list[KeywordRanking]] = {}
    for r in all_my_rankings:
        by_keyword.setdefault(r.keyword_id, []).append(r)

    kw_map = {kw.id: kw for kw in keywords}

    for kw_id, rankings in by_keyword.items():
        if not rankings:
            continue
        # distinct crawled_at 시각 추출 (이미 desc 정렬)
        seen_times = []
        for r in rankings:
            if not seen_times or r.crawled_at != seen_times[-1]:
                seen_times.append(r.crawled_at)
            if len(seen_times) >= 2:
                break
        if len(seen_times) < 2:
            continue

        current_ranks = [r.rank for r in rankings if r.crawled_at == seen_times[0]]
        prev_ranks = [r.rank for r in rankings if r.crawled_at == seen_times[1]]
        if not current_ranks or not prev_ranks:
            continue

        current_rank = min(current_ranks)
        prev_rank = min(prev_ranks)

        if current_rank > prev_rank:
            if "rank_drop" in prefetched["recent_alert_types"]:
                continue

            kw = kw_map.get(kw_id)
            kw_name = kw.keyword if kw else ""
            title = f"{product.name} - 순위 하락"
            message = f"'{kw_name}' 키워드에서 {prev_rank}위 → {current_rank}위로 하락"
            alert = Alert(
                user_id=product.user_id,
                product_id=product.id,
                type="rank_drop",
                title=title,
                message=message,
                data={
                    "keyword_id": kw_id,
                    "keyword": kw_name,
                    "prev_rank": prev_rank,
                    "current_rank": current_rank,
                },
            )
            db.add(alert)
            await send_push_to_user(db, product.user_id, title, message, {"type": "rank_drop", "product_id": product.id})
            await send_telegram_to_user(db, product.user_id, title, message, alert_type="rank_drop")


async def check_and_create_alerts(
    db: AsyncSession,
    product: Product,
    keywords: list[SearchKeyword],
    naver_store_name: str | None,
):
    """크롤링 완료 후 호출 - 모든 알림 조건 체크.

    N+1 최적화: 알림 설정/중복 체크/블랙리스트/최신 rankings을
    한 번에 배치 조회 후 개별 체크 함수에 전달.
    """
    prefetched = await _batch_prefetch(db, product.user_id, product, keywords)
    await _check_price_undercut(db, product, keywords, prefetched)
    await _check_rank_drop(db, product, keywords, naver_store_name, prefetched)
