from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.utils import next_sequence
from app.deps import get_current_user
from app.models.contract import Contract
from app.models.procurement import PurchaseOrder
from app.models.user import User
from app.models.vendor import Vendor, VendorStatus
from app.schemas.vendor import VendorCreate, VendorUpdate, VendorOut

router = APIRouter(prefix="/vendors", tags=["vendors"])


def _serialize(db: Session, vendor: Vendor) -> VendorOut:
    out = VendorOut.model_validate(vendor)
    out.contract_count = (
        db.query(Contract).filter(Contract.vendor_id == vendor.id).count()
    )
    out.po_count = (
        db.query(PurchaseOrder).filter(PurchaseOrder.vendor_id == vendor.id).count()
    )
    return out


@router.get("", response_model=list[VendorOut])
def list_vendors(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    search: str | None = Query(None),
    status: VendorStatus | None = Query(None),
):
    query = db.query(Vendor)
    if search:
        like = f"%{search}%"
        query = query.filter(
            (Vendor.name.ilike(like)) | (Vendor.code.ilike(like))
        )
    if status:
        query = query.filter(Vendor.status == status)
    vendors = query.order_by(Vendor.name).all()
    return [_serialize(db, v) for v in vendors]


@router.get("/{vendor_id}", response_model=VendorOut)
def get_vendor(
    vendor_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)
):
    vendor = db.get(Vendor, vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return _serialize(db, vendor)


@router.post("", response_model=VendorOut, status_code=201)
def create_vendor(
    payload: VendorCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    code = payload.code or next_sequence(db, Vendor, Vendor.code, "VEN-")
    if db.query(Vendor).filter(Vendor.code == code).first():
        raise HTTPException(status_code=400, detail="Vendor code already exists")
    data = payload.model_dump(exclude={"code"})
    vendor = Vendor(code=code, **data)
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return _serialize(db, vendor)


@router.patch("/{vendor_id}", response_model=VendorOut)
def update_vendor(
    vendor_id: int,
    payload: VendorUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    vendor = db.get(Vendor, vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(vendor, key, value)
    db.commit()
    db.refresh(vendor)
    return _serialize(db, vendor)


@router.delete("/{vendor_id}", status_code=204)
def delete_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    vendor = db.get(Vendor, vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    linked = db.query(Contract).filter(Contract.vendor_id == vendor_id).count()
    if linked:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete a vendor that still has contracts. Mark it inactive instead.",
        )
    db.delete(vendor)
    db.commit()
