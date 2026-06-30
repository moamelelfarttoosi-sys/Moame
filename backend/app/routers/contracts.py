from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.utils import next_sequence, year_prefix
from app.deps import get_current_user
from app.models.contract import Contract, ContractStatus, ContractType
from app.models.user import User
from app.schemas.contract import ContractCreate, ContractUpdate, ContractOut

router = APIRouter(prefix="/contracts", tags=["contracts"])


def _serialize(contract: Contract) -> ContractOut:
    out = ContractOut.model_validate(contract)
    out.vendor_name = contract.vendor.name if contract.vendor else None
    out.owner_name = contract.owner.full_name if contract.owner else None
    if contract.end_date:
        out.days_to_expiry = (contract.end_date - date.today()).days
    return out


@router.get("", response_model=list[ContractOut])
def list_contracts(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    search: str | None = Query(None),
    status: ContractStatus | None = Query(None),
    type: ContractType | None = Query(None),
    vendor_id: int | None = Query(None),
    expiring_in_days: int | None = Query(None),
):
    query = db.query(Contract)
    if search:
        like = f"%{search}%"
        query = query.filter(
            (Contract.title.ilike(like)) | (Contract.contract_number.ilike(like))
        )
    if status:
        query = query.filter(Contract.status == status)
    if type:
        query = query.filter(Contract.type == type)
    if vendor_id:
        query = query.filter(Contract.vendor_id == vendor_id)
    contracts = query.order_by(Contract.created_at.desc()).all()

    results = [_serialize(c) for c in contracts]
    if expiring_in_days is not None:
        results = [
            c
            for c in results
            if c.days_to_expiry is not None and 0 <= c.days_to_expiry <= expiring_in_days
        ]
    return results


@router.get("/{contract_id}", response_model=ContractOut)
def get_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    contract = db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    return _serialize(contract)


@router.post("", response_model=ContractOut, status_code=201)
def create_contract(
    payload: ContractCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    number = payload.contract_number or next_sequence(
        db, Contract, Contract.contract_number, year_prefix("CON")
    )
    if db.query(Contract).filter(Contract.contract_number == number).first():
        raise HTTPException(status_code=400, detail="Contract number already exists")
    contract = Contract(
        contract_number=number, **payload.model_dump(exclude={"contract_number"})
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return _serialize(contract)


@router.patch("/{contract_id}", response_model=ContractOut)
def update_contract(
    contract_id: int,
    payload: ContractUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    contract = db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(contract, key, value)
    db.commit()
    db.refresh(contract)
    return _serialize(contract)


@router.delete("/{contract_id}", status_code=204)
def delete_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    contract = db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    db.delete(contract)
    db.commit()
