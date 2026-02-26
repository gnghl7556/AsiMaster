"""add source_preset_id to cost_items and remove product cost_preset_id

Revision ID: 5dd9619c97ec
Revises: fa420faac16c
Create Date: 2026-02-26 17:59:54.227751

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '5dd9619c97ec'
down_revision: Union[str, None] = 'fa420faac16c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. CostItem에 source_preset_id 컬럼 추가
    op.add_column('cost_items', sa.Column('source_preset_id', sa.Integer(), nullable=True))
    op.create_index('ix_cost_items_source_preset', 'cost_items', ['product_id', 'source_preset_id'], unique=False)
    op.create_foreign_key(
        'fk_cost_items_source_preset_id', 'cost_items', 'cost_presets',
        ['source_preset_id'], ['id'], ondelete='SET NULL',
    )

    # 2. 기존 데이터 마이그레이션: products.cost_preset_id → cost_items.source_preset_id
    op.execute("""
        UPDATE cost_items ci
        SET source_preset_id = p.cost_preset_id
        FROM products p
        WHERE ci.product_id = p.id
        AND p.cost_preset_id IS NOT NULL
    """)

    # 3. products에서 cost_preset_id 컬럼 제거
    op.drop_constraint('fk_products_cost_preset_id', 'products', type_='foreignkey')
    op.drop_column('products', 'cost_preset_id')


def downgrade() -> None:
    # 1. products에 cost_preset_id 복원
    op.add_column('products', sa.Column('cost_preset_id', sa.INTEGER(), nullable=True))
    op.create_foreign_key(
        'fk_products_cost_preset_id', 'products', 'cost_presets',
        ['cost_preset_id'], ['id'], ondelete='SET NULL',
    )

    # 2. CostItem의 source_preset_id 중 첫 번째를 Product로 복원
    op.execute("""
        UPDATE products p
        SET cost_preset_id = sub.source_preset_id
        FROM (
            SELECT DISTINCT ON (product_id) product_id, source_preset_id
            FROM cost_items
            WHERE source_preset_id IS NOT NULL
            ORDER BY product_id, id
        ) sub
        WHERE p.id = sub.product_id
    """)

    # 3. cost_items에서 source_preset_id 제거
    op.drop_constraint('fk_cost_items_source_preset_id', 'cost_items', type_='foreignkey')
    op.drop_index('ix_cost_items_source_preset', table_name='cost_items')
    op.drop_column('cost_items', 'source_preset_id')
