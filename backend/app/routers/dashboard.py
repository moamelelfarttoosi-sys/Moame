from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.vendor import Vendor, VendorStatus
from app.models.contract import Contract, ContractStatus
from app.models.procurement import (
    PurchaseRequest,
    PurchaseOrder,
    PurchaseOrderItem,
    RequestStatus,
    OrderStatus,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
def summary(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    today = date.today()
    soon = today + timedelta(days=30)

    active_contracts = (
        db.query(Contract).filter(Contract.status == ContractStatus.active).count()
    )
    total_contract_value = (
        db.query(func.coalesce(func.sum(Contract.value), 0.0))
        .filter(Contract.status == ContractStatus.active)
        .scalar()
    )
    expiring_soon = (
        db.query(Contract)
        .filter(
            Contract.end_date.isnot(None),
            Contract.end_date >= today,
            Contract.end_date <= soon,
            Contract.status == ContractStatus.active,
        )
        .count()
    )

    # Spend = total of all purchase order line items not cancelled
    po_spend = (
        db.query(
            func.coalesce(
                func.sum(PurchaseOrderItem.quantity * PurchaseOrderItem.unit_price),
                0.0,
            )
        )
        .join(PurchaseOrder, PurchaseOrder.id == PurchaseOrderItem.order_id)
        .filter(PurchaseOrder.status != OrderStatus.cancelled)
        .scalar()
    )

    return {
        "vendors": {
            "total": db.query(Vendor).count(),
            "active": db.query(Vendor)
            .filter(Vendor.status == VendorStatus.active)
            .count(),
        },
        "contracts": {
            "total": db.query(Contract).count(),
            "active": active_contracts,
            "expiring_soon": expiring_soon,
            "total_value": round(total_contract_value, 2),
        },
        "requests": {
            "total": db.query(PurchaseRequest).count(),
            "pending": db.query(PurchaseRequest)
            .filter(PurchaseRequest.status == RequestStatus.submitted)
            .count(),
        },
        "orders": {
            "total": db.query(PurchaseOrder).count(),
            "open": db.query(PurchaseOrder)
            .filter(
                PurchaseOrder.status.in_(
                    [OrderStatus.issued, OrderStatus.partially_received]
                )
            )
            .count(),
            "total_spend": round(po_spend, 2),
        },
    }


@router.get("/contracts-by-status")
def contracts_by_status(
    db: Session = Depends(get_db), _: User = Depends(get_current_user)
):
    rows = (
        db.query(Contract.status, func.count(Contract.id))
        .group_by(Contract.status)
        .all()
    )
    return [{"status": s.value, "count": c} for s, c in rows]


@router.get("/spend-by-vendor")
def spend_by_vendor(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    limit: int = 8,
):
    rows = (
        db.query(
            Vendor.name,
            func.coalesce(
                func.sum(PurchaseOrderItem.quantity * PurchaseOrderItem.unit_price),
                0.0,
            ).label("spend"),
        )
        .join(PurchaseOrder, PurchaseOrder.vendor_id == Vendor.id)
        .join(PurchaseOrderItem, PurchaseOrderItem.order_id == PurchaseOrder.id)
        .filter(PurchaseOrder.status != OrderStatus.cancelled)
        .group_by(Vendor.id)
        .order_by(func.sum(PurchaseOrderItem.quantity * PurchaseOrderItem.unit_price).desc())
        .limit(limit)
        .all()
    )
    return [{"vendor": name, "spend": round(spend, 2)} for name, spend in rows]


@router.get("/expiring-contracts")
def expiring_contracts(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    days: int = 60,
):
    today = date.today()
    horizon = today + timedelta(days=days)
    contracts = (
        db.query(Contract)
        .filter(
            Contract.end_date.isnot(None),
            Contract.end_date >= today,
            Contract.end_date <= horizon,
        )
        .order_by(Contract.end_date)
        .all()
    )
    return [
        {
            "id": c.id,
            "contract_number": c.contract_number,
            "title": c.title,
            "end_date": c.end_date.isoformat() if c.end_date else None,
            "days_to_expiry": (c.end_date - today).days if c.end_date else None,
            "vendor_name": c.vendor.name if c.vendor else None,
            "value": c.value,
        }
        for c in contracts
    ]
