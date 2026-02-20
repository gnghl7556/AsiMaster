from datetime import datetime

from sqlalchemy import ForeignKey, Index, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PriceHistory(Base):
    __tablename__ = "price_history"
    __table_args__ = (
        Index("ix_price_history_competitor_crawled", "competitor_id", "crawled_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    competitor_id: Mapped[int] = mapped_column(ForeignKey("competitors.id", ondelete="CASCADE"), nullable=False)
    price: Mapped[int] = mapped_column(Integer, nullable=False)
    shipping_fee: Mapped[int] = mapped_column(Integer, default=0)
    total_price: Mapped[int] = mapped_column(Integer, nullable=False)
    ranking: Mapped[int | None] = mapped_column(Integer)
    total_sellers: Mapped[int | None] = mapped_column(Integer)
    crawled_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    competitor: Mapped["Competitor"] = relationship(back_populates="price_history")
