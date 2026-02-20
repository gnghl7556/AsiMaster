from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import Alert
from app.models.crawl_log import CrawlLog
from app.models.product import Product
from app.services.product_service import get_product_list_items


async def get_dashboard_summary(db: AsyncSession, user_id: int) -> dict:
    items = await get_product_list_items(db, user_id)

    active_items = [i for i in items if not i["is_price_locked"]]
    locked_items = [i for i in items if i["is_price_locked"]]

    status_counts = {"winning": 0, "close": 0, "losing": 0}
    margins = []
    last_crawled = None

    for item in active_items:
        status_counts[item["status"]] = status_counts.get(item["status"], 0) + 1
        if item["margin_percent"] is not None:
            margins.append(item["margin_percent"])
        if item["last_crawled_at"]:
            if last_crawled is None or item["last_crawled_at"] > last_crawled:
                last_crawled = item["last_crawled_at"]

    avg_margin = round(sum(margins) / len(margins), 1) if margins else None

    # 읽지 않은 알림 수
    unread_result = await db.execute(
        select(func.count(Alert.id)).where(Alert.user_id == user_id, Alert.is_read == False)
    )
    unread_alerts = unread_result.scalar() or 0

    # 크롤링 성공률 (최근 100건)
    log_result = await db.execute(
        select(CrawlLog.status)
        .order_by(CrawlLog.created_at.desc())
        .limit(100)
    )
    logs = log_result.scalars().all()
    success_rate = None
    if logs:
        success_count = sum(1 for s in logs if s == "success")
        success_rate = round((success_count / len(logs)) * 100, 1)

    return {
        "total_products": len(items),
        "active_products": len(active_items),
        "price_locked_products": len(locked_items),
        "status_counts": status_counts,
        "avg_margin_percent": avg_margin,
        "unread_alerts": unread_alerts,
        "last_crawled_at": last_crawled,
        "crawl_success_rate": success_rate,
    }
