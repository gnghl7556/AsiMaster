from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.models.alert import Alert, AlertSetting
from app.schemas.alert import AlertResponse, AlertSettingResponse, AlertSettingUpdate

router = APIRouter(tags=["alerts"])


@router.get("/users/{user_id}/alerts", response_model=list[AlertResponse])
async def get_alerts(
    user_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * size
    result = await db.execute(
        select(Alert)
        .where(Alert.user_id == user_id)
        .order_by(Alert.created_at.desc())
        .offset(offset)
        .limit(size)
    )
    return result.scalars().all()


@router.patch("/alerts/{alert_id}/read", response_model=AlertResponse)
async def mark_alert_read(alert_id: int, db: AsyncSession = Depends(get_db)):
    alert = await db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(404, "알림을 찾을 수 없습니다.")
    alert.is_read = True
    await db.flush()
    await db.refresh(alert)
    return alert


@router.post("/users/{user_id}/alerts/read-all", status_code=204)
async def mark_all_read(user_id: int, db: AsyncSession = Depends(get_db)):
    await db.execute(
        update(Alert).where(Alert.user_id == user_id, Alert.is_read == False).values(is_read=True)
    )


@router.get("/users/{user_id}/alert-settings", response_model=list[AlertSettingResponse])
async def get_alert_settings(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AlertSetting).where(AlertSetting.user_id == user_id)
    )
    return result.scalars().all()


@router.put("/users/{user_id}/alert-settings", response_model=list[AlertSettingResponse])
async def update_alert_settings(
    user_id: int, settings: list[AlertSettingUpdate], db: AsyncSession = Depends(get_db)
):
    results = []
    for s in settings:
        result = await db.execute(
            select(AlertSetting).where(
                AlertSetting.user_id == user_id, AlertSetting.alert_type == s.alert_type
            )
        )
        setting = result.scalar_one_or_none()
        if setting:
            setting.is_enabled = s.is_enabled
            setting.threshold = s.threshold
        else:
            setting = AlertSetting(
                user_id=user_id,
                alert_type=s.alert_type,
                is_enabled=s.is_enabled,
                threshold=s.threshold,
            )
            db.add(setting)
        await db.flush()
        await db.refresh(setting)
        results.append(setting)
    return results
