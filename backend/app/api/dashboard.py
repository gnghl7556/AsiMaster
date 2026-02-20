import csv
import io

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.schemas.dashboard import DashboardSummary
from app.services.dashboard_service import get_dashboard_summary
from app.services.product_service import get_product_list_items

router = APIRouter(tags=["dashboard"])


@router.get("/users/{user_id}/dashboard/summary", response_model=DashboardSummary)
async def dashboard_summary(user_id: int, db: AsyncSession = Depends(get_db)):
    return await get_dashboard_summary(db, user_id)


@router.get("/users/{user_id}/dashboard/export")
async def export_csv(user_id: int, db: AsyncSession = Depends(get_db)):
    items = await get_product_list_items(db, user_id)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "상품명", "카테고리", "판매가", "최저가", "차이", "차이(%)",
        "순위", "마진(원)", "마진(%)", "상태", "가격고정"
    ])
    for item in items:
        writer.writerow([
            item["name"],
            item["category"] or "",
            item["selling_price"],
            item["lowest_price"] or "",
            item["price_gap"] or "",
            item["price_gap_percent"] or "",
            item["ranking"] or "",
            item["margin_amount"] or "",
            item["margin_percent"] or "",
            item["status"],
            "Y" if item["is_price_locked"] else "N",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=price-monitor-export.csv"},
    )
