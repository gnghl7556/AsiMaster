from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cost import CostItem, CostPreset
from app.models.product import Product


async def apply_preset_to_products(
    db: AsyncSession,
    preset: CostPreset,
    product_ids: list[int],
) -> dict:
    """프리셋을 복수 상품에 일괄 적용. 반환: {applied, skipped, skipped_ids, skipped_reason}."""
    # 모든 요청 ID로 상품 존재 여부 먼저 확인
    all_result = await db.execute(
        select(Product.id, Product.user_id).where(Product.id.in_(product_ids))
    )
    all_rows = all_result.all()
    existing_ids = {row[0] for row in all_rows}
    not_found_ids = [pid for pid in product_ids if pid not in existing_ids]
    wrong_user_ids = [row[0] for row in all_rows if row[1] != preset.user_id]

    # 프리셋 소유자의 상품만 필터
    result = await db.execute(
        select(Product).where(
            Product.id.in_(product_ids),
            Product.user_id == preset.user_id,
        )
    )
    products = result.scalars().all()

    if not products:
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

    found_ids = {p.id for p in products}

    # 기존 cost_items 일괄 삭제
    await db.execute(
        delete(CostItem).where(CostItem.product_id.in_(found_ids))
    )

    # 프리셋 items로 새 CostItem 생성 + cost_preset_id 갱신
    for product in products:
        for item_data in preset.items:
            db.add(CostItem(
                product_id=product.id,
                name=item_data["name"],
                type=item_data["type"],
                value=item_data["value"],
                sort_order=item_data.get("sort_order", 0),
            ))
        product.cost_preset_id = preset.id

    await db.flush()

    skipped_ids = [pid for pid in product_ids if pid not in found_ids]
    skipped_reason = None
    if skipped_ids:
        reasons = []
        if not_found_ids:
            reasons.append(f"존재하지 않는 상품: {not_found_ids}")
        if wrong_user_ids:
            reasons.append(f"다른 사업체 소속 상품: {wrong_user_ids}")
        skipped_reason = "; ".join(reasons) if reasons else None
    return {
        "applied": len(products),
        "skipped": len(skipped_ids),
        "skipped_ids": skipped_ids,
        "skipped_reason": skipped_reason,
    }
