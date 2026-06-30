from datetime import datetime, date

from pydantic import BaseModel

from app.models.procurement import RequestStatus, OrderStatus


# ---------- Purchase Request ----------
class RequestItemBase(BaseModel):
    description: str
    quantity: float = 1
    unit: str | None = None
    unit_price: float = 0.0


class RequestItemOut(RequestItemBase):
    id: int
    line_total: float

    model_config = {"from_attributes": True}


class PurchaseRequestBase(BaseModel):
    title: str
    department: str | None = None
    justification: str | None = None
    status: RequestStatus = RequestStatus.draft
    needed_by: date | None = None
    requester_id: int | None = None


class PurchaseRequestCreate(PurchaseRequestBase):
    request_number: str | None = None
    items: list[RequestItemBase] = []


class PurchaseRequestUpdate(BaseModel):
    title: str | None = None
    department: str | None = None
    justification: str | None = None
    status: RequestStatus | None = None
    needed_by: date | None = None
    items: list[RequestItemBase] | None = None


class PurchaseRequestOut(PurchaseRequestBase):
    id: int
    request_number: str
    estimated_total: float
    requester_name: str | None = None
    items: list[RequestItemOut] = []
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Purchase Order ----------
class OrderItemBase(BaseModel):
    description: str
    quantity: float = 1
    unit: str | None = None
    unit_price: float = 0.0
    received_quantity: float = 0.0


class OrderItemOut(OrderItemBase):
    id: int
    line_total: float

    model_config = {"from_attributes": True}


class PurchaseOrderBase(BaseModel):
    status: OrderStatus = OrderStatus.draft
    currency: str = "USD"
    notes: str | None = None
    order_date: date | None = None
    expected_date: date | None = None
    vendor_id: int | None = None
    contract_id: int | None = None
    request_id: int | None = None


class PurchaseOrderCreate(PurchaseOrderBase):
    po_number: str | None = None
    items: list[OrderItemBase] = []


class PurchaseOrderUpdate(BaseModel):
    status: OrderStatus | None = None
    currency: str | None = None
    notes: str | None = None
    order_date: date | None = None
    expected_date: date | None = None
    vendor_id: int | None = None
    contract_id: int | None = None
    items: list[OrderItemBase] | None = None


class PurchaseOrderOut(PurchaseOrderBase):
    id: int
    po_number: str
    total_amount: float
    received_pct: float
    vendor_name: str | None = None
    items: list[OrderItemOut] = []
    created_at: datetime

    model_config = {"from_attributes": True}
