from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cost import CostItem, CostPreset
from app.models.product import Product


async def apply_preset_to_products(
    db: AsyncSession,
    preset: CostPreset,
    product_ids: list[int],
) -> dict:
    """프리셋을 복수 상품에 중첩 적용. 동일 프리셋 중복은 스킵."""
    # 1. 상품 존재 여부 + 소유자 확인
    all_result = await db.execute(
        select(Product.id, Product.user_id).where(Product.id.in_(product_ids))
    )
    all_rows = all_result.all()
    existing_ids = {row[0] for row in all_rows}
    not_found_ids = [pid for pid in product_ids if pid not in existing_ids]
    wrong_user_ids = [row[0] for row in all_rows if row[1] != preset.user_id]

    # 프리셋 소유자의 상품만 필터
    valid_ids = {row[0] for row in all_rows if row[1] == preset.user_id}

    if not valid_ids:
        reason = None
        if not_found_ids:
            reason = f"존재하지 않는 상품: {not_found_ids}"
        elif wrong_user_ids:
            reason = f"다른 사업체 소속 상품: {wrong_user_ids}"
        return {
            "applied": 0,
            "skipped": len(product_ids),
            "skipped_ids": product_ids,
            "skipped_reason": reason,
        }

    # 2. 이미 동일 프리셋이 적용된 상품 체크 (중복 방지)
    already_result = await db.execute(
        select(CostItem.product_id)
        .where(
            CostItem.product_id.in_(valid_ids),
            CostItem.source_preset_id == preset.id,
        )
        .distinct()
    )
    already_applied = {row[0] for row in already_result.all()}

    # 3. 실제 적용 대상 = valid - already_applied
    target_ids = valid_ids - already_applied

    # 4. 프리셋 항목 추가 (기존 수동/다른 프리셋 항목은 유지)
    for pid in target_ids:
        for item_data in preset.items:
            db.add(CostItem(
                product_id=pid,
                source_preset_id=preset.id,
                name=item_data["name"],
                type=item_data["type"],
                value=item_data["value"],
                sort_order=item_data.get("sort_order", 0),
            ))

    await db.flush()

    # 5. 스킵 사유 구분
    skipped_ids = [pid for pid in product_ids if pid not in target_ids]
    skipped_reason = None
    if skipped_ids:
        reasons = []
        if not_found_ids:
            reasons.append(f"존재하지 않는 상품: {not_found_ids}")
        if wrong_user_ids:
            reasons.append(f"다른 사업체 소속 상품: {wrong_user_ids}")
        if already_applied:
            reasons.append(f"이미 적용된 상품: {sorted(already_applied)}")
        skipped_reason = "; ".join(reasons) if reasons else None
    return {
        "applied": len(target_ids),
        "skipped": len(skipped_ids),
        "skipped_ids": skipped_ids,
        "skipped_reason": skipped_reason,
    }


async def detach_preset_from_products(
    db: AsyncSession,
    preset_id: int,
    product_ids: list[int],
) -> dict:
    """특정 프리셋의 항목만 제거 (수동 항목 + 다른 프리셋 항목은 유지)."""
    # 삭제 대상 확인
    before_result = await db.execute(
        select(CostItem.product_id)
        .where(
            CostItem.product_id.in_(product_ids),
            CostItem.source_preset_id == preset_id,
        )
        .distinct()
    )
    detachable_pids = {row[0] for row in before_result.all()}

    if detachable_pids:
        await db.execute(
            delete(CostItem).where(
                CostItem.product_id.in_(detachable_pids),
                CostItem.source_preset_id == preset_id,
            )
        )
        await db.flush()

    return {
        "detached": len(detachable_pids),
        "skipped": len(product_ids) - len(detachable_pids),
    }


async def get_applied_preset_ids(db: AsyncSession, product_id: int) -> list[int]:
    """상품에 적용된 프리셋 ID 목록 조회."""
    result = await db.execute(
        select(CostItem.source_preset_id)
        .where(
            CostItem.product_id == product_id,
            CostItem.source_preset_id.isnot(None),
        )
        .distinct()
    )
    return sorted(row[0] for row in result.all())


async def get_applied_preset_ids_batch(
    db: AsyncSession, product_ids: list[int],
) -> dict[int, list[int]]:
    """복수 상품의 적용된 프리셋 ID 배치 조회."""
    result = await db.execute(
        select(CostItem.product_id, CostItem.source_preset_id)
        .where(
            CostItem.product_id.in_(product_ids),
            CostItem.source_preset_id.isnot(None),
        )
        .distinct()
    )
    preset_map: dict[int, list[int]] = {pid: [] for pid in product_ids}
    for row in result.all():
        preset_map[row[0]].append(row[1])
    for pids in preset_map.values():
        pids.sort()
    return preset_map
