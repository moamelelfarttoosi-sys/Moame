from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.utils import next_sequence, year_prefix
from app.deps import get_current_user
from app.models.user import User
from app.models.procurement import (
    PurchaseRequest,
    PurchaseRequestItem,
    PurchaseOrder,
    PurchaseOrderItem,
    RequestStatus,
    OrderStatus,
)
from app.schemas.procurement import (
    PurchaseRequestCreate,
    PurchaseRequestUpdate,
    PurchaseRequestOut,
    PurchaseOrderCreate,
    PurchaseOrderUpdate,
    PurchaseOrderOut,
)

router = APIRouter(tags=["procurement"])


# ============================ Purchase Requests ============================
def _serialize_request(req: PurchaseRequest) -> PurchaseRequestOut:
    out = PurchaseRequestOut.model_validate(req)
    out.requester_name = req.requester.full_name if req.requester else None
    return out


@router.get("/requests", response_model=list[PurchaseRequestOut])
def list_requests(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    status: RequestStatus | None = Query(None),
    search: str | None = Query(None),
):
    query = db.query(PurchaseRequest)
    if status:
        query = query.filter(PurchaseRequest.status == status)
    if search:
        like = f"%{search}%"
        query = query.filter(
            (PurchaseRequest.title.ilike(like))
            | (PurchaseRequest.request_number.ilike(like))
        )
    return [
        _serialize_request(r)
        for r in query.order_by(PurchaseRequest.created_at.desc()).all()
    ]


@router.get("/requests/{request_id}", response_model=PurchaseRequestOut)
def get_request(
    request_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)
):
    req = db.get(PurchaseRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Purchase request not found")
    return _serialize_request(req)


@router.post("/requests", response_model=PurchaseRequestOut, status_code=201)
def create_request(
    payload: PurchaseRequestCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    number = payload.request_number or next_sequence(
        db, PurchaseRequest, PurchaseRequest.request_number, year_prefix("PR")
    )
    data = payload.model_dump(exclude={"request_number", "items"})
    if not data.get("requester_id"):
        data["requester_id"] = current.id
    req = PurchaseRequest(request_number=number, **data)
    for item in payload.items:
        req.items.append(PurchaseRequestItem(**item.model_dump()))
    db.add(req)
    db.commit()
    db.refresh(req)
    return _serialize_request(req)


@router.patch("/requests/{request_id}", response_model=PurchaseRequestOut)
def update_request(
    request_id: int,
    payload: PurchaseRequestUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    req = db.get(PurchaseRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Purchase request not found")
    data = payload.model_dump(exclude_unset=True)
    items = data.pop("items", None)
    for key, value in data.items():
        setattr(req, key, value)
    if items is not None:
        req.items.clear()
        for item in items:
            req.items.append(PurchaseRequestItem(**item))
    db.commit()
    db.refresh(req)
    return _serialize_request(req)


@router.delete("/requests/{request_id}", status_code=204)
def delete_request(
    request_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)
):
    req = db.get(PurchaseRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Purchase request not found")
    db.delete(req)
    db.commit()


@router.post("/requests/{request_id}/convert", response_model=PurchaseOrderOut)
def convert_request_to_order(
    request_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Turn an approved purchase request into a draft purchase order."""
    req = db.get(PurchaseRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Purchase request not found")
    if req.status != RequestStatus.approved:
        raise HTTPException(
            status_code=400, detail="Only approved requests can be converted"
        )
    po_number = next_sequence(
        db, PurchaseOrder, PurchaseOrder.po_number, year_prefix("PO")
    )
    order = PurchaseOrder(
        po_number=po_number,
        request_id=req.id,
        created_by=current.id,
        status=OrderStatus.draft,
    )
    for item in req.items:
        order.items.append(
            PurchaseOrderItem(
                description=item.description,
                quantity=item.quantity,
                unit=item.unit,
                unit_price=item.unit_price,
            )
        )
    req.status = RequestStatus.converted
    db.add(order)
    db.commit()
    db.refresh(order)
    return _serialize_order(order)


# ============================ Purchase Orders ============================
def _serialize_order(order: PurchaseOrder) -> PurchaseOrderOut:
    out = PurchaseOrderOut.model_validate(order)
    out.vendor_name = order.vendor.name if order.vendor else None
    return out


def _sync_order_status(order: PurchaseOrder) -> None:
    """Keep order status consistent with received quantities."""
    if order.status in (OrderStatus.draft, OrderStatus.cancelled):
        return
    pct = order.received_pct
    if pct >= 100:
        order.status = OrderStatus.received
    elif pct > 0:
        order.status = OrderStatus.partially_received
    else:
        order.status = OrderStatus.issued


@router.get("/orders", response_model=list[PurchaseOrderOut])
def list_orders(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    status: OrderStatus | None = Query(None),
    vendor_id: int | None = Query(None),
    search: str | None = Query(None),
):
    query = db.query(PurchaseOrder)
    if status:
        query = query.filter(PurchaseOrder.status == status)
    if vendor_id:
        query = query.filter(PurchaseOrder.vendor_id == vendor_id)
    if search:
        query = query.filter(PurchaseOrder.po_number.ilike(f"%{search}%"))
    return [
        _serialize_order(o)
        for o in query.order_by(PurchaseOrder.created_at.desc()).all()
    ]


@router.get("/orders/{order_id}", response_model=PurchaseOrderOut)
def get_order(
    order_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)
):
    order = db.get(PurchaseOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return _serialize_order(order)


@router.post("/orders", response_model=PurchaseOrderOut, status_code=201)
def create_order(
    payload: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    po_number = payload.po_number or next_sequence(
        db, PurchaseOrder, PurchaseOrder.po_number, year_prefix("PO")
    )
    if db.query(PurchaseOrder).filter(PurchaseOrder.po_number == po_number).first():
        raise HTTPException(status_code=400, detail="PO number already exists")
    order = PurchaseOrder(
        po_number=po_number,
        created_by=current.id,
        **payload.model_dump(exclude={"po_number", "items"}),
    )
    for item in payload.items:
        order.items.append(PurchaseOrderItem(**item.model_dump()))
    db.add(order)
    db.commit()
    db.refresh(order)
    return _serialize_order(order)


@router.patch("/orders/{order_id}", response_model=PurchaseOrderOut)
def update_order(
    order_id: int,
    payload: PurchaseOrderUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    order = db.get(PurchaseOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    data = payload.model_dump(exclude_unset=True)
    items = data.pop("items", None)
    for key, value in data.items():
        setattr(order, key, value)
    if items is not None:
        order.items.clear()
        for item in items:
            order.items.append(PurchaseOrderItem(**item))
    _sync_order_status(order)
    db.commit()
    db.refresh(order)
    return _serialize_order(order)


@router.delete("/orders/{order_id}", status_code=204)
def delete_order(
    order_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)
):
    order = db.get(PurchaseOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    db.delete(order)
    db.commit()
