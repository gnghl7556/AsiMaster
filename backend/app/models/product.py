from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        Index("ix_products_user_id", "user_id"),
        Index("ix_products_user_category", "user_id", "category"),
        Index("ix_products_user_locked", "user_id", "is_price_locked"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str | None] = mapped_column(String(100))
    cost_price: Mapped[int] = mapped_column(Integer, nullable=False)
    selling_price: Mapped[int] = mapped_column(Integer, nullable=False)
    image_url: Mapped[str | None] = mapped_column(String(500))
    is_price_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    price_lock_reason: Mapped[str | None] = mapped_column(String(200))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship(back_populates="products")
    competitors: Mapped[list["Competitor"]] = relationship(back_populates="product", cascade="all, delete-orphan")
    cost_items: Mapped[list["CostItem"]] = relationship(back_populates="product", cascade="all, delete-orphan")
