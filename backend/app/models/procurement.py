import enum
from datetime import datetime, date, timezone

from sqlalchemy import String, Text, Enum, DateTime, Date, Float, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class RequestStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"
    approved = "approved"
    rejected = "rejected"
    converted = "converted"  # turned into a purchase order


class OrderStatus(str, enum.Enum):
    draft = "draft"
    issued = "issued"
    partially_received = "partially_received"
    received = "received"
    cancelled = "cancelled"


class PurchaseRequest(Base):
    __tablename__ = "purchase_requests"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    request_number: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    department: Mapped[str | None] = mapped_column(String(120), nullable=True)
    justification: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[RequestStatus] = mapped_column(
        Enum(RequestStatus), default=RequestStatus.draft, nullable=False
    )
    needed_by: Mapped[date | None] = mapped_column(Date, nullable=True)

    requester_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    approver_id: Mapped[int | None] = mapped_column(
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

    requester: Mapped["User | None"] = relationship(  # noqa: F821
        foreign_keys=[requester_id]
    )
    items: Mapped[list["PurchaseRequestItem"]] = relationship(
        back_populates="request", cascade="all, delete-orphan"
    )

    @property
    def estimated_total(self) -> float:
        return round(sum(i.line_total for i in self.items), 2)


class PurchaseRequestItem(Base):
    __tablename__ = "purchase_request_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(
        ForeignKey("purchase_requests.id", ondelete="CASCADE")
    )
    description: Mapped[str] = mapped_column(String(255))
    quantity: Mapped[float] = mapped_column(Float, default=1)
    unit: Mapped[str | None] = mapped_column(String(40), nullable=True)
    unit_price: Mapped[float] = mapped_column(Float, default=0.0)

    request: Mapped["PurchaseRequest"] = relationship(back_populates="items")

    @property
    def line_total(self) -> float:
        return round(self.quantity * self.unit_price, 2)


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    po_number: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus), default=OrderStatus.draft, nullable=False
    )
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    order_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expected_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    vendor_id: Mapped[int | None] = mapped_column(
        ForeignKey("vendors.id"), nullable=True
    )
    contract_id: Mapped[int | None] = mapped_column(
        ForeignKey("contracts.id"), nullable=True
    )
    request_id: Mapped[int | None] = mapped_column(
        ForeignKey("purchase_requests.id"), nullable=True
    )
    created_by: Mapped[int | None] = mapped_column(
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
        back_populates="purchase_orders"
    )
    contract: Mapped["Contract | None"] = relationship(  # noqa: F821
        back_populates="purchase_orders"
    )
    items: Mapped[list["PurchaseOrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )

    @property
    def total_amount(self) -> float:
        return round(sum(i.line_total for i in self.items), 2)

    @property
    def received_pct(self) -> float:
        ordered = sum(i.quantity for i in self.items)
        if ordered == 0:
            return 0.0
        received = sum(i.received_quantity for i in self.items)
        return round(received / ordered * 100, 1)


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("purchase_orders.id", ondelete="CASCADE")
    )
    description: Mapped[str] = mapped_column(String(255))
    quantity: Mapped[float] = mapped_column(Float, default=1)
    unit: Mapped[str | None] = mapped_column(String(40), nullable=True)
    unit_price: Mapped[float] = mapped_column(Float, default=0.0)
    received_quantity: Mapped[float] = mapped_column(Float, default=0.0)

    order: Mapped["PurchaseOrder"] = relationship(back_populates="items")

    @property
    def line_total(self) -> float:
        return round(self.quantity * self.unit_price, 2)
