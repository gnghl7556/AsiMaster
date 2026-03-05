"""비용 프리셋 서비스 테스트 — 적용, 중첩, 중복 방지, 해제."""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cost import CostItem, CostPreset
from app.models.product import Product
from app.models.user import User
from app.services.cost_service import (
    apply_preset_to_products,
    detach_preset_from_products,
    get_applied_preset_ids,
)


async def _create_user_and_product(db: AsyncSession, user_name="테스트") -> tuple[User, Product]:
    """유저와 상품을 생성하는 헬퍼."""
    user = User(name=user_name)
    db.add(user)
    await db.flush()
    product = Product(
        user_id=user.id,
        name="테스트 상품",
        cost_price=10000,
        selling_price=20000,
    )
    db.add(product)
    await db.flush()
    return user, product


async def _create_preset(db: AsyncSession, user_id: int, name="프리셋A", items=None) -> CostPreset:
    """프리셋을 생성하는 헬퍼."""
    if items is None:
        items = [{"name": "수수료", "type": "percent", "value": 10, "sort_order": 0}]
    preset = CostPreset(user_id=user_id, name=name, items=items)
    db.add(preset)
    await db.flush()
    return preset


@pytest.mark.asyncio
async def test_apply_preset_additive(db):
    """프리셋 적용이 기존 수동 항목을 유지하고 추가되는지 확인."""
    user, product = await _create_user_and_product(db)

    # 수동 비용 항목 추가
    manual_item = CostItem(
        product_id=product.id,
        source_preset_id=None,
        name="택배비",
        type="fixed",
        value=3000,
    )
    db.add(manual_item)
    await db.flush()

    # 프리셋 적용
    preset = await _create_preset(db, user.id)
    result = await apply_preset_to_products(db, preset, [product.id])

    assert result["applied"] == 1
    assert result["skipped"] == 0

    # 수동 항목 + 프리셋 항목 모두 존재
    items_result = await db.execute(
        select(CostItem).where(CostItem.product_id == product.id)
    )
    all_items = items_result.scalars().all()
    assert len(all_items) == 2

    manual = [i for i in all_items if i.source_preset_id is None]
    preset_items = [i for i in all_items if i.source_preset_id == preset.id]
    assert len(manual) == 1
    assert len(preset_items) == 1
    assert manual[0].name == "택배비"


@pytest.mark.asyncio
async def test_apply_multiple_presets(db):
    """서로 다른 프리셋을 동시에 적용할 수 있는지 확인."""
    user, product = await _create_user_and_product(db)

    preset_a = await _create_preset(db, user.id, "프리셋A",
                                     [{"name": "수수료A", "type": "percent", "value": 5, "sort_order": 0}])
    preset_b = await _create_preset(db, user.id, "프리셋B",
                                     [{"name": "수수료B", "type": "fixed", "value": 1000, "sort_order": 0}])

    result_a = await apply_preset_to_products(db, preset_a, [product.id])
    result_b = await apply_preset_to_products(db, preset_b, [product.id])

    assert result_a["applied"] == 1
    assert result_b["applied"] == 1

    preset_ids = await get_applied_preset_ids(db, product.id)
    assert sorted(preset_ids) == sorted([preset_a.id, preset_b.id])


@pytest.mark.asyncio
async def test_apply_same_preset_duplicate_prevention(db):
    """동일 프리셋 중복 적용 시 스킵되는지 확인."""
    user, product = await _create_user_and_product(db)
    preset = await _create_preset(db, user.id)

    # 첫 번째 적용
    result1 = await apply_preset_to_products(db, preset, [product.id])
    assert result1["applied"] == 1

    # 두 번째 적용 (중복)
    result2 = await apply_preset_to_products(db, preset, [product.id])
    assert result2["applied"] == 0
    assert result2["skipped"] == 1
    assert "이미 적용된" in (result2["skipped_reason"] or "")


@pytest.mark.asyncio
async def test_detach_preset_removes_only_preset_items(db):
    """프리셋 해제 시 해당 프리셋 항목만 삭제되고 수동 항목은 유지되는지 확인."""
    user, product = await _create_user_and_product(db)

    # 수동 항목
    db.add(CostItem(
        product_id=product.id, source_preset_id=None,
        name="택배비", type="fixed", value=3000,
    ))
    await db.flush()

    # 프리셋 A 적용
    preset_a = await _create_preset(db, user.id, "프리셋A")
    await apply_preset_to_products(db, preset_a, [product.id])

    # 프리셋 B 적용
    preset_b = await _create_preset(db, user.id, "프리셋B",
                                     [{"name": "포장비", "type": "fixed", "value": 500, "sort_order": 0}])
    await apply_preset_to_products(db, preset_b, [product.id])

    # 프리셋 A 해제
    result = await detach_preset_from_products(db, preset_a.id, [product.id])
    assert result["detached"] == 1

    # 수동 항목 + 프리셋 B 항목만 남음
    items_result = await db.execute(
        select(CostItem).where(CostItem.product_id == product.id)
    )
    remaining = items_result.scalars().all()
    assert len(remaining) == 2
    sources = {i.source_preset_id for i in remaining}
    assert None in sources         # 수동 항목
    assert preset_b.id in sources  # 프리셋 B
    assert preset_a.id not in sources  # 프리셋 A는 제거됨


@pytest.mark.asyncio
async def test_detach_nonexistent_preset(db):
    """적용되지 않은 프리셋 해제 시 skipped 처리."""
    user, product = await _create_user_and_product(db)
    result = await detach_preset_from_products(db, 9999, [product.id])
    assert result["detached"] == 0
    assert result["skipped"] == 1


@pytest.mark.asyncio
async def test_apply_preset_wrong_user(db):
    """다른 사업체 소속 상품에 프리셋 적용 시 스킵."""
    user_a, product_a = await _create_user_and_product(db, "사업체A")
    user_b = User(name="사업체B")
    db.add(user_b)
    await db.flush()

    preset_b = await _create_preset(db, user_b.id, "프리셋B")
    result = await apply_preset_to_products(db, preset_b, [product_a.id])

    assert result["applied"] == 0
    assert result["skipped"] == 1
    assert "다른 사업체" in (result["skipped_reason"] or "")
