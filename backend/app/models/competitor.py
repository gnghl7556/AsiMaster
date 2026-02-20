from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Competitor(Base):
    __tablename__ = "competitors"
    __table_args__ = (
        Index("ix_competitors_product_id", "product_id"),
        Index("ix_competitors_platform_id", "platform_id"),
        Index("ix_competitors_crawl_status", "crawl_status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    platform_id: Mapped[int] = mapped_column(ForeignKey("platforms.id"), nullable=False)
    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    seller_name: Mapped[str | None] = mapped_column(String(200))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_crawled_at: Mapped[datetime | None] = mapped_column()
    crawl_status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    product: Mapped["Product"] = relationship(back_populates="competitors")
    platform: Mapped["Platform"] = relationship(back_populates="competitors")
    price_history: Mapped[list["PriceHistory"]] = relationship(back_populates="competitor", cascade="all, delete-orphan")
