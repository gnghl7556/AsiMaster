from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select, update
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
    CostPresetResponse,
    CostPresetUpdate,
)
from app.services.cost_service import apply_preset_to_products

router = APIRouter(tags=["costs"])


@router.get("/products/{product_id}/costs", response_model=list[CostItemResponse])
async def get_cost_items(product_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CostItem).where(CostItem.product_id == product_id).order_by(CostItem.sort_order)
    )
    return result.scalars().all()


@router.put("/products/{product_id}/costs", response_model=list[CostItemResponse])
async def save_cost_items(
    product_id: int, items: list[CostItemCreate], db: AsyncSession = Depends(get_db)
):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "상품을 찾을 수 없습니다.")
    # 수동 수정 시 프리셋 연결 해제
    product.cost_preset_id = None
    await db.execute(delete(CostItem).where(CostItem.product_id == product_id))
    new_items = []
    for item in items:
        cost_item = CostItem(product_id=product_id, **item.model_dump())
        db.add(cost_item)
        new_items.append(cost_item)
    await db.flush()
    for item in new_items:
        await db.refresh(item)
    return new_items


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
    preset = await db.get(CostPreset, preset_id)
    if not preset:
        raise HTTPException(404, "프리셋을 찾을 수 없습니다.")

    result = await apply_preset_to_products(db, preset, data.product_ids)
    if result["applied"] == 0:
        raise HTTPException(400, "적용 가능한 상품이 없습니다.")
    return result


@router.delete("/cost-presets/{preset_id}", status_code=204)
async def delete_cost_preset(preset_id: int, db: AsyncSession = Depends(get_db)):
    preset = await db.get(CostPreset, preset_id)
    if not preset:
        raise HTTPException(404, "프리셋을 찾을 수 없습니다.")
    # 참조 상품의 cost_preset_id를 NULL로 설정
    await db.execute(
        update(Product)
        .where(Product.cost_preset_id == preset_id)
        .values(cost_preset_id=None)
    )
    await db.delete(preset)
