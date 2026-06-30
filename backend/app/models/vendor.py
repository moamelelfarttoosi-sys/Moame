import enum
from datetime import datetime, timezone

from sqlalchemy import String, Text, Enum, DateTime, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class VendorStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    blacklisted = "blacklisted"
    pending = "pending"


class Vendor(Base):
    __tablename__ = "vendors"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    category: Mapped[str | None] = mapped_column(String(120), nullable=True)
    contact_person: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(60), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    tax_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    status: Mapped[VendorStatus] = mapped_column(
        Enum(VendorStatus), default=VendorStatus.active, nullable=False
    )
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    contracts: Mapped[list["Contract"]] = relationship(  # noqa: F821
        back_populates="vendor"
    )
    purchase_orders: Mapped[list["PurchaseOrder"]] = relationship(  # noqa: F821
        back_populates="vendor"
    )
