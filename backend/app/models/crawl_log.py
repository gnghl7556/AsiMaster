from datetime import datetime

from sqlalchemy import ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CrawlLog(Base):
    __tablename__ = "crawl_logs"
    __table_args__ = (
        Index("ix_crawl_logs_platform_created", "platform_id", "created_at"),
        Index("ix_crawl_logs_status", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    competitor_id: Mapped[int | None] = mapped_column(ForeignKey("competitors.id", ondelete="SET NULL"))
    platform_id: Mapped[int] = mapped_column(ForeignKey("platforms.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
