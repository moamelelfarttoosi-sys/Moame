import enum
from datetime import datetime, date, timezone

from sqlalchemy import String, Text, Enum, DateTime, Date, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ContractStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    expired = "expired"
    terminated = "terminated"
    renewed = "renewed"
    pending_approval = "pending_approval"


class ContractType(str, enum.Enum):
    service = "service"
    supply = "supply"
    lease = "lease"
    consulting = "consulting"
    maintenance = "maintenance"
    framework = "framework"
    other = "other"


class Contract(Base):
    __tablename__ = "contracts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    contract_number: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    type: Mapped[ContractType] = mapped_column(
        Enum(ContractType), default=ContractType.service, nullable=False
    )
    status: Mapped[ContractStatus] = mapped_column(
        Enum(ContractStatus), default=ContractStatus.draft, nullable=False
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    value: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    payment_terms: Mapped[str | None] = mapped_column(String(255), nullable=True)

    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    renewal_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    auto_renew: Mapped[bool] = mapped_column(default=False)

    vendor_id: Mapped[int | None] = mapped_column(
        ForeignKey("vendors.id"), nullable=True
    )
    owner_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    vendor: Mapped["Vendor | None"] = relationship(  # noqa: F821
        back_populates="contracts"
    )
    owner: Mapped["User | None"] = relationship()  # noqa: F821
    purchase_orders: Mapped[list["PurchaseOrder"]] = relationship(  # noqa: F821
        back_populates="contract"
    )
