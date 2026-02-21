from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SearchKeyword(Base):
    __tablename__ = "search_keywords"
    __table_args__ = (
        Index("ix_search_keywords_product_id", "product_id"),
        Index("ix_search_keywords_crawl_status", "crawl_status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    keyword: Mapped[str] = mapped_column(String(200), nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_crawled_at: Mapped[datetime | None] = mapped_column()
    crawl_status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    product: Mapped["Product"] = relationship(back_populates="keywords")
    rankings: Mapped[list["KeywordRanking"]] = relationship(back_populates="keyword", cascade="all, delete-orphan")
