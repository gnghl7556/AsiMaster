from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class KeywordRanking(Base):
    __tablename__ = "keyword_rankings"
    __table_args__ = (
        Index("ix_keyword_rankings_keyword_crawled", "keyword_id", "crawled_at"),
        Index("ix_keyword_rankings_is_my_store", "is_my_store"),
        Index("ix_keyword_rankings_naver_product_id", "naver_product_id"),
        Index("ix_keyword_rankings_crawled_at", "crawled_at"),
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
    hprice: Mapped[int] = mapped_column(Integer, default=0)
    brand: Mapped[str | None] = mapped_column(String(200))
    maker: Mapped[str | None] = mapped_column(String(200))
    product_type: Mapped[str | None] = mapped_column(String(10))
    category1: Mapped[str | None] = mapped_column(String(100))
    category2: Mapped[str | None] = mapped_column(String(100))
    category3: Mapped[str | None] = mapped_column(String(100))
    category4: Mapped[str | None] = mapped_column(String(100))
    shipping_fee: Mapped[int] = mapped_column(Integer, default=0)
    shipping_fee_type: Mapped[str] = mapped_column(String(20), default="unknown")
    crawled_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    keyword: Mapped["SearchKeyword"] = relationship(back_populates="rankings")
