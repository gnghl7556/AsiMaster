from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cost import CostItem
from app.models.product import Product
from app.services.product_service import calculate_margin


async def get_margin(db: AsyncSession, product_id: int) -> dict | None:
    product = await db.get(Product, product_id)
    if not product:
        return None

    result = await db.execute(
        select(CostItem).where(CostItem.product_id == product_id).order_by(CostItem.sort_order)
    )
    cost_items = [
        {"name": ci.name, "type": ci.type, "value": float(ci.value)}
        for ci in result.scalars().all()
    ]
    return calculate_margin(product.selling_price, product.cost_price, cost_items)


async def simulate_margin(
    db: AsyncSession, product_id: int, new_selling_price: int
) -> dict | None:
    product = await db.get(Product, product_id)
    if not product:
        return None

    result = await db.execute(
        select(CostItem).where(CostItem.product_id == product_id).order_by(CostItem.sort_order)
    )
    cost_items = [
        {"name": ci.name, "type": ci.type, "value": float(ci.value)}
        for ci in result.scalars().all()
    ]
    return calculate_margin(new_selling_price, product.cost_price, cost_items)
