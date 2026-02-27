"""add shipping_overrides table

Revision ID: 501b7cb4e9f1
Revises: 5dd9619c97ec
Create Date: 2026-02-27 16:05:51.851996

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '501b7cb4e9f1'
down_revision: Union[str, None] = '5dd9619c97ec'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('shipping_overrides',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('product_id', sa.Integer(), nullable=False),
    sa.Column('naver_product_id', sa.String(length=50), nullable=False),
    sa.Column('shipping_fee', sa.Integer(), nullable=False),
    sa.Column('naver_product_name', sa.String(length=500), nullable=True),
    sa.Column('mall_name', sa.String(length=200), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_shipping_override_naver', 'shipping_overrides', ['product_id', 'naver_product_id'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_shipping_override_naver', table_name='shipping_overrides')
    op.drop_table('shipping_overrides')
