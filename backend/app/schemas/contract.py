from datetime import datetime, date

from pydantic import BaseModel

from app.models.contract import ContractStatus, ContractType


class ContractBase(BaseModel):
    title: str
    type: ContractType = ContractType.service
    status: ContractStatus = ContractStatus.draft
    description: str | None = None
    value: float = 0.0
    currency: str = "USD"
    payment_terms: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    renewal_date: date | None = None
    auto_renew: bool = False
    vendor_id: int | None = None
    owner_id: int | None = None


class ContractCreate(ContractBase):
    contract_number: str | None = None  # auto-generated when omitted


class ContractUpdate(BaseModel):
    title: str | None = None
    type: ContractType | None = None
    status: ContractStatus | None = None
    description: str | None = None
    value: float | None = None
    currency: str | None = None
    payment_terms: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    renewal_date: date | None = None
    auto_renew: bool | None = None
    vendor_id: int | None = None
    owner_id: int | None = None


class ContractOut(ContractBase):
    id: int
    contract_number: str
    created_at: datetime
    updated_at: datetime
    vendor_name: str | None = None
    owner_name: str | None = None
    days_to_expiry: int | None = None

    model_config = {"from_attributes": True}
