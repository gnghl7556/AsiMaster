from datetime import datetime

from sqlalchemy import String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    naver_store_name: Mapped[str | None] = mapped_column(String(200))
    crawl_interval_min: Mapped[int] = mapped_column(default=60)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    products: Mapped[list["Product"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    alerts: Mapped[list["Alert"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    alert_settings: Mapped[list["AlertSetting"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    cost_presets: Mapped[list["CostPreset"]] = relationship(back_populates="user", cascade="all, delete-orphan")
