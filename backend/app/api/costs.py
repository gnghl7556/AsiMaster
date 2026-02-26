from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.models.cost import CostItem, CostPreset
from app.models.product import Product
from app.models.user import User
from app.schemas.cost import (
    CostItemCreate,
    CostItemResponse,
    CostPresetApplyRequest,
    CostPresetApplyResponse,
    CostPresetCreate,
    CostPresetDetachRequest,
    CostPresetDetachResponse,
    CostPresetResponse,
    CostPresetUpdate,
)
from app.services.cost_service import apply_preset_to_products, detach_preset_from_products

router = APIRouter(tags=["costs"])


@router.get("/products/{product_id}/costs", response_model=list[CostItemResponse])
async def get_cost_items(product_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CostItem).where(CostItem.product_id == product_id).order_by(CostItem.sort_order)
    )
    return result.scalars().all()


@router.put("/products/{product_id}/costs", response_model=list[CostItemResponse])
async def save_cost_items(
    product_id: int,
    items: list[CostItemCreate],
    db: AsyncSession = Depends(get_db),
):
    """수동 비용 항목 저장. 프리셋에서 온 항목은 유지하고, 수동 항목만 교체."""
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "상품을 찾을 수 없습니다.")
    # 수동 항목(source_preset_id=NULL)만 삭제
    await db.execute(
        delete(CostItem).where(
            CostItem.product_id == product_id,
            CostItem.source_preset_id.is_(None),
        )
    )
    for item in items:
        db.add(CostItem(product_id=product_id, source_preset_id=None, **item.model_dump()))
    await db.flush()
    # 수동 + 프리셋 전체 반환
    result = await db.execute(
        select(CostItem).where(CostItem.product_id == product_id).order_by(CostItem.sort_order)
    )
    return result.scalars().all()


@router.get("/users/{user_id}/cost-presets", response_model=list[CostPresetResponse])
async def get_cost_presets(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CostPreset).where(CostPreset.user_id == user_id).order_by(CostPreset.created_at)
    )
    return result.scalars().all()


@router.post("/users/{user_id}/cost-presets", response_model=CostPresetResponse, status_code=201)
async def create_cost_preset(
    user_id: int, data: CostPresetCreate, db: AsyncSession = Depends(get_db)
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "사업체를 찾을 수 없습니다.")
    preset = CostPreset(
        user_id=user_id,
        name=data.name,
        items=[item.model_dump() for item in data.items],
    )
    db.add(preset)
    await db.flush()
    await db.refresh(preset)
    return preset


@router.put("/cost-presets/{preset_id}", response_model=CostPresetResponse)
async def update_cost_preset(
    preset_id: int, data: CostPresetUpdate, db: AsyncSession = Depends(get_db)
):
    preset = await db.get(CostPreset, preset_id)
    if not preset:
        raise HTTPException(404, "프리셋을 찾을 수 없습니다.")
    if data.name is not None:
        preset.name = data.name
    if data.items is not None:
        preset.items = [item.model_dump() for item in data.items]
    await db.flush()
    await db.refresh(preset)
    return preset


@router.post("/cost-presets/{preset_id}/apply", response_model=CostPresetApplyResponse)
async def apply_cost_preset(
    preset_id: int, data: CostPresetApplyRequest, db: AsyncSession = Depends(get_db)
):
    """프리셋을 상품에 중첩 적용. 동일 프리셋 중복 적용은 스킵."""
    preset = await db.get(CostPreset, preset_id)
    if not preset:
        raise HTTPException(404, "프리셋을 찾을 수 없습니다.")

    result = await apply_preset_to_products(db, preset, data.product_ids)
    if result["applied"] == 0:
        raise HTTPException(
            400,
            detail={
                "message": "적용 가능한 상품이 없습니다.",
                "skipped_ids": result["skipped_ids"],
                "reason": result.get("skipped_reason", "요청한 상품이 존재하지 않거나 이미 적용된 프리셋입니다."),
            },
        )
    return result


@router.post("/cost-presets/{preset_id}/detach", response_model=CostPresetDetachResponse)
async def detach_cost_preset(
    preset_id: int, data: CostPresetDetachRequest, db: AsyncSession = Depends(get_db)
):
    """프리셋 해제. 해당 프리셋에서 온 비용 항목만 제거."""
    preset = await db.get(CostPreset, preset_id)
    if not preset:
        raise HTTPException(404, "프리셋을 찾을 수 없습니다.")
    return await detach_preset_from_products(db, preset_id, data.product_ids)


@router.delete("/cost-presets/{preset_id}", status_code=204)
async def delete_cost_preset(preset_id: int, db: AsyncSession = Depends(get_db)):
    preset = await db.get(CostPreset, preset_id)
    if not preset:
        raise HTTPException(404, "프리셋을 찾을 수 없습니다.")
    # source_preset_id FK의 SET NULL로 CostItem 자동 처리 (수동 항목으로 전환)
    await db.delete(preset)
