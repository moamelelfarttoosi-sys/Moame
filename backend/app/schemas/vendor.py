from datetime import datetime

from pydantic import BaseModel

from app.models.vendor import VendorStatus


class VendorBase(BaseModel):
    name: str
    category: str | None = None
    contact_person: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    tax_id: str | None = None
    status: VendorStatus = VendorStatus.active
    rating: float | None = None
    notes: str | None = None


class VendorCreate(VendorBase):
    code: str | None = None  # auto-generated when omitted


class VendorUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    contact_person: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    tax_id: str | None = None
    status: VendorStatus | None = None
    rating: float | None = None
    notes: str | None = None


class VendorOut(VendorBase):
    id: int
    code: str
    created_at: datetime
    updated_at: datetime
    contract_count: int = 0
    po_count: int = 0

    model_config = {"from_attributes": True}
