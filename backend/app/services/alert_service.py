"""알림 자동 생성 서비스 (크롤링 후 호출)"""

import logging

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import Alert, AlertSetting
from app.models.excluded_product import ExcludedProduct
from app.models.keyword_ranking import KeywordRanking
from app.models.product import Product
from app.models.search_keyword import SearchKeyword
from app.services.push_service import send_push_to_user

logger = logging.getLogger(__name__)


async def _is_alert_enabled(db: AsyncSession, user_id: int, alert_type: str) -> tuple[bool, float | None]:
    result = await db.execute(
        select(AlertSetting).where(
            AlertSetting.user_id == user_id,
            AlertSetting.alert_type == alert_type,
        )
    )
    setting = result.scalar_one_or_none()
    if setting is None:
        return True, None
    return setting.is_enabled, float(setting.threshold) if setting.threshold else None


async def check_price_undercut(
    db: AsyncSession, product: Product, keywords: list[SearchKeyword]
):
    """최저가 이탈: 전체 키워드 결과 최저가 < 내 판매가."""
    enabled, _ = await _is_alert_enabled(db, product.user_id, "price_undercut")
    if not enabled:
        return

    # 블랙리스트 조회
    ex_result = await db.execute(
        select(ExcludedProduct).where(ExcludedProduct.product_id == product.id)
    )
    excluded_rows = ex_result.scalars().all()
    excluded_ids = {ep.naver_product_id for ep in excluded_rows}
    excluded_malls = {ep.mall_name.strip().lower() for ep in excluded_rows if ep.mall_name}

    # 각 키워드의 최신 rankings에서 최저가 찾기 (관련 상품만, 블랙리스트 제외)
    all_latest = []
    for kw in keywords:
        result = await db.execute(
            select(KeywordRanking)
            .where(
                KeywordRanking.keyword_id == kw.id,
                KeywordRanking.is_relevant == True,
            )
            .order_by(KeywordRanking.crawled_at.desc())
            .limit(10)
        )
        rankings = result.scalars().all()
        if rankings:
            latest_time = rankings[0].crawled_at
            for r in rankings:
                if r.crawled_at != latest_time:
                    break
                if r.naver_product_id and r.naver_product_id in excluded_ids:
                    continue
                if r.mall_name and r.mall_name.strip().lower() in excluded_malls:
                    continue
                all_latest.append(r)

    if not all_latest:
        return

    lowest = min(all_latest, key=lambda r: r.price)
    if lowest.price >= product.selling_price:
        return

    gap = product.selling_price - lowest.price
    gap_percent = (gap / product.selling_price) * 100 if product.selling_price > 0 else 0

    title = f"{product.name} - 최저가 이탈"
    message = f"{lowest.mall_name} {lowest.price:,}원 (내 가격 대비 -{gap:,}원, -{gap_percent:.1f}%)"
    alert = Alert(
        user_id=product.user_id,
        product_id=product.id,
        type="price_undercut",
        title=title,
        message=message,
        data={
            "keyword": lowest.keyword.keyword if hasattr(lowest, 'keyword') and lowest.keyword else "",
            "my_price": product.selling_price,
            "competitor_price": lowest.price,
            "competitor_name": lowest.mall_name,
            "gap": gap,
            "gap_percent": round(gap_percent, 1),
        },
    )
    db.add(alert)
    await send_push_to_user(db, product.user_id, title, message, {"type": "price_undercut", "product_id": product.id})


async def check_rank_drop(
    db: AsyncSession, product: Product, keywords: list[SearchKeyword], naver_store_name: str | None
):
    """내 순위 하락 감지."""
    if not naver_store_name:
        return

    enabled, threshold = await _is_alert_enabled(db, product.user_id, "rank_drop")
    if not enabled:
        return

    for kw in keywords:
        # 최신 2번의 크롤링 결과 비교
        result = await db.execute(
            select(KeywordRanking.crawled_at)
            .where(KeywordRanking.keyword_id == kw.id, KeywordRanking.is_my_store == True)
            .order_by(KeywordRanking.crawled_at.desc())
            .distinct()
            .limit(2)
        )
        times = result.scalars().all()
        if len(times) < 2:
            continue

        # 현재 순위 (내 스토어 상품이 복수일 수 있으므로 최고 순위 사용)
        current_result = await db.execute(
            select(func.min(KeywordRanking.rank))
            .where(
                KeywordRanking.keyword_id == kw.id,
                KeywordRanking.is_my_store == True,
                KeywordRanking.crawled_at == times[0],
            )
        )
        current_rank = current_result.scalar_one_or_none()

        # 이전 순위
        prev_result = await db.execute(
            select(func.min(KeywordRanking.rank))
            .where(
                KeywordRanking.keyword_id == kw.id,
                KeywordRanking.is_my_store == True,
                KeywordRanking.crawled_at == times[1],
            )
        )
        prev_rank = prev_result.scalar_one_or_none()

        if current_rank is None or prev_rank is None:
            continue

        if current_rank > prev_rank:
            title = f"{product.name} - 순위 하락"
            message = f"'{kw.keyword}' 키워드에서 {prev_rank}위 → {current_rank}위로 하락"
            alert = Alert(
                user_id=product.user_id,
                product_id=product.id,
                type="rank_drop",
                title=title,
                message=message,
                data={
                    "keyword_id": kw.id,
                    "keyword": kw.keyword,
                    "prev_rank": prev_rank,
                    "current_rank": current_rank,
                },
            )
            db.add(alert)
            await send_push_to_user(db, product.user_id, title, message, {"type": "rank_drop", "product_id": product.id})


async def check_new_competitor(
    db: AsyncSession, product: Product, keywords: list[SearchKeyword]
):
    """키워드 결과에 새 판매자 등장."""
    enabled, _ = await _is_alert_enabled(db, product.user_id, "new_competitor")
    if not enabled:
        return
    # 새 판매자 감지는 복잡하므로 일단 skip (향후 구현)


async def check_and_create_alerts(
    db: AsyncSession,
    product: Product,
    keywords: list[SearchKeyword],
    naver_store_name: str | None,
):
    """크롤링 완료 후 호출 - 모든 알림 조건 체크."""
    await check_price_undercut(db, product, keywords)
    await check_rank_drop(db, product, keywords, naver_store_name)
    await check_new_competitor(db, product, keywords)
