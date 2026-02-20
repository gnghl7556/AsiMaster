"""알림 자동 생성 서비스 (크롤링 후 호출)"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import Alert, AlertSetting
from app.models.competitor import Competitor
from app.models.price_history import PriceHistory
from app.models.product import Product


async def _is_alert_enabled(db: AsyncSession, user_id: int, alert_type: str) -> tuple[bool, float | None]:
    """알림 설정 확인. (활성 여부, 임계값) 반환."""
    result = await db.execute(
        select(AlertSetting).where(
            AlertSetting.user_id == user_id,
            AlertSetting.alert_type == alert_type,
        )
    )
    setting = result.scalar_one_or_none()
    if setting is None:
        return True, None  # 설정 없으면 기본 활성
    return setting.is_enabled, float(setting.threshold) if setting.threshold else None


async def check_price_undercut(db: AsyncSession, product: Product, competitor: Competitor, new_price: int):
    """최저가 이탈 체크: 경쟁사가 내 가격보다 낮아졌을 때 알림 생성."""
    enabled, _ = await _is_alert_enabled(db, product.user_id, "price_undercut")
    if not enabled:
        return

    total_price = new_price
    if total_price >= product.selling_price:
        return

    gap = product.selling_price - total_price
    gap_percent = (gap / product.selling_price) * 100 if product.selling_price > 0 else 0

    alert = Alert(
        user_id=product.user_id,
        product_id=product.id,
        type="price_undercut",
        title=f"{product.name} - 최저가 이탈",
        message=f"경쟁사 가격 {total_price:,}원 (내 가격 대비 -{gap:,}원, -{gap_percent:.1f}%)",
        data={
            "competitor_id": competitor.id,
            "my_price": product.selling_price,
            "competitor_price": total_price,
            "gap": gap,
            "gap_percent": round(gap_percent, 1),
        },
    )
    db.add(alert)


async def check_price_surge(db: AsyncSession, product: Product, competitor: Competitor, new_price: int):
    """가격 급변동 체크: 이전 가격 대비 임계값 이상 변동 시 알림."""
    enabled, threshold = await _is_alert_enabled(db, product.user_id, "price_surge")
    if not enabled:
        return

    if threshold is None:
        threshold = 10.0  # 기본 10%

    # 이전 가격 조회
    result = await db.execute(
        select(PriceHistory.total_price)
        .where(PriceHistory.competitor_id == competitor.id)
        .order_by(PriceHistory.crawled_at.desc())
        .offset(1)
        .limit(1)
    )
    prev_price = result.scalar_one_or_none()
    if prev_price is None or prev_price == 0:
        return

    change_percent = abs(new_price - prev_price) / prev_price * 100
    if change_percent < threshold:
        return

    direction = "상승" if new_price > prev_price else "하락"
    alert = Alert(
        user_id=product.user_id,
        product_id=product.id,
        type="price_surge",
        title=f"{product.name} - 가격 급{direction}",
        message=f"경쟁사 가격 {prev_price:,}원 → {new_price:,}원 ({change_percent:.1f}% {direction})",
        data={
            "competitor_id": competitor.id,
            "prev_price": prev_price,
            "new_price": new_price,
            "change_percent": round(change_percent, 1),
            "direction": direction,
        },
    )
    db.add(alert)


async def check_new_competitor(db: AsyncSession, product: Product, competitor: Competitor):
    """신규 경쟁자 체크: 새로 등록된 경쟁사의 첫 크롤링 성공 시 알림."""
    enabled, _ = await _is_alert_enabled(db, product.user_id, "new_competitor")
    if not enabled:
        return

    # 가격 이력이 1개(방금 추가된 것)뿐이면 신규
    result = await db.execute(
        select(func.count()).where(PriceHistory.competitor_id == competitor.id)
    )
    count = result.scalar_one()
    if count != 1:
        return

    alert = Alert(
        user_id=product.user_id,
        product_id=product.id,
        type="new_competitor",
        title=f"{product.name} - 신규 경쟁자 감지",
        message=f"새로운 판매자가 감지되었습니다: {competitor.seller_name or '알 수 없음'}",
        data={
            "competitor_id": competitor.id,
            "seller_name": competitor.seller_name,
        },
    )
    db.add(alert)


async def check_and_create_alerts(
    db: AsyncSession, product: Product, competitor: Competitor, new_total_price: int
):
    """크롤링 완료 후 호출 - 모든 알림 조건 체크."""
    await check_price_undercut(db, product, competitor, new_total_price)
    await check_price_surge(db, product, competitor, new_total_price)
    await check_new_competitor(db, product, competitor)
