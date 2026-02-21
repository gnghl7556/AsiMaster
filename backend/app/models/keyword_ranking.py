from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class KeywordRanking(Base):
    __tablename__ = "keyword_rankings"
    __table_args__ = (
        Index("ix_keyword_rankings_keyword_crawled", "keyword_id", "crawled_at"),
        Index("ix_keyword_rankings_is_my_store", "is_my_store"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    keyword_id: Mapped[int] = mapped_column(ForeignKey("search_keywords.id", ondelete="CASCADE"), nullable=False)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    product_name: Mapped[str] = mapped_column(String(500), nullable=False)
    price: Mapped[int] = mapped_column(Integer, nullable=False)
    mall_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    product_url: Mapped[str | None] = mapped_column(String(1000))
    image_url: Mapped[str | None] = mapped_column(String(1000))
    naver_product_id: Mapped[str | None] = mapped_column(String(50))
    is_my_store: Mapped[bool] = mapped_column(Boolean, default=False)
    is_relevant: Mapped[bool] = mapped_column(Boolean, default=True)
    crawled_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    keyword: Mapped["SearchKeyword"] = relationship(back_populates="rankings")
