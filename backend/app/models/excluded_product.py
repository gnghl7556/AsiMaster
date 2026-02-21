from datetime import datetime

from sqlalchemy import ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ExcludedProduct(Base):
    __tablename__ = "excluded_products"
    __table_args__ = (
        Index("ix_excluded_product_naver", "product_id", "naver_product_id", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    naver_product_id: Mapped[str] = mapped_column(String(50), nullable=False)
    naver_product_name: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    product: Mapped["Product"] = relationship(back_populates="excluded_products")
