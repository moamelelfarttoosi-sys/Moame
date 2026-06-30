"""Seed the database with a demo dataset.

Run with:  python -m app.seed
"""
from datetime import date, timedelta

from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.vendor import Vendor, VendorStatus
from app.models.contract import Contract, ContractStatus, ContractType
from app.models.procurement import (
    PurchaseRequest,
    PurchaseRequestItem,
    PurchaseOrder,
    PurchaseOrderItem,
    RequestStatus,
    OrderStatus,
)


def run() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).count() > 0:
            print("Database already seeded — skipping.")
            return

        today = date.today()

        # ---- Users ----
        admin = User(
            email="admin@moame.app",
            full_name="System Administrator",
            role=UserRole.admin,
            department="IT",
            hashed_password=hash_password("admin123"),
        )
        manager = User(
            email="manager@moame.app",
            full_name="Procurement Manager",
            role=UserRole.manager,
            department="Procurement",
            hashed_password=hash_password("manager123"),
        )
        staff = User(
            email="staff@moame.app",
            full_name="Procurement Officer",
            role=UserRole.staff,
            department="Operations",
            hashed_password=hash_password("staff123"),
        )
        db.add_all([admin, manager, staff])
        db.flush()

        # ---- Vendors ----
        vendors = [
            Vendor(
                code="VEN-0001",
                name="Globex Industrial Supplies",
                category="Equipment",
                contact_person="Sara Khalil",
                email="sales@globex.example",
                phone="+1-202-555-0143",
                status=VendorStatus.active,
                rating=4.5,
            ),
            Vendor(
                code="VEN-0002",
                name="Initech Software LLC",
                category="IT Services",
                contact_person="John Reed",
                email="contact@initech.example",
                phone="+1-202-555-0188",
                status=VendorStatus.active,
                rating=4.1,
            ),
            Vendor(
                code="VEN-0003",
                name="Acme Facilities Management",
                category="Facilities",
                contact_person="Maria Gomez",
                email="ops@acme-fm.example",
                phone="+1-202-555-0177",
                status=VendorStatus.active,
                rating=3.8,
            ),
            Vendor(
                code="VEN-0004",
                name="Sterling Logistics",
                category="Logistics",
                contact_person="Omar Faruk",
                email="hello@sterling.example",
                status=VendorStatus.pending,
                rating=None,
            ),
        ]
        db.add_all(vendors)
        db.flush()

        # ---- Contracts ----
        contracts = [
            Contract(
                contract_number=f"CON-{today.year}-0001",
                title="Annual IT Support & Maintenance",
                type=ContractType.maintenance,
                status=ContractStatus.active,
                value=120000,
                currency="USD",
                payment_terms="Net 30, billed quarterly",
                start_date=today - timedelta(days=120),
                end_date=today + timedelta(days=20),  # expiring soon
                vendor_id=vendors[1].id,
                owner_id=manager.id,
                auto_renew=True,
            ),
            Contract(
                contract_number=f"CON-{today.year}-0002",
                title="Office Cleaning Services",
                type=ContractType.service,
                status=ContractStatus.active,
                value=48000,
                currency="USD",
                payment_terms="Net 15, monthly",
                start_date=today - timedelta(days=30),
                end_date=today + timedelta(days=335),
                vendor_id=vendors[2].id,
                owner_id=staff.id,
            ),
            Contract(
                contract_number=f"CON-{today.year}-0003",
                title="Industrial Equipment Supply Agreement",
                type=ContractType.supply,
                status=ContractStatus.active,
                value=250000,
                currency="USD",
                start_date=today - timedelta(days=200),
                end_date=today + timedelta(days=160),
                vendor_id=vendors[0].id,
                owner_id=manager.id,
            ),
            Contract(
                contract_number=f"CON-{today.year}-0004",
                title="Warehouse Lease — North Depot",
                type=ContractType.lease,
                status=ContractStatus.draft,
                value=96000,
                currency="USD",
                start_date=today + timedelta(days=10),
                end_date=today + timedelta(days=375),
                vendor_id=vendors[3].id,
                owner_id=manager.id,
            ),
        ]
        db.add_all(contracts)
        db.flush()

        # ---- Purchase Requests ----
        pr = PurchaseRequest(
            request_number=f"PR-{today.year}-0001",
            title="New laptops for engineering team",
            department="Engineering",
            justification="Replacing end-of-life devices for 5 engineers.",
            status=RequestStatus.approved,
            needed_by=today + timedelta(days=21),
            requester_id=staff.id,
            approver_id=manager.id,
        )
        pr.items = [
            PurchaseRequestItem(
                description="Developer Laptop 16in", quantity=5, unit="unit",
                unit_price=1800,
            ),
            PurchaseRequestItem(
                description="Docking Station", quantity=5, unit="unit", unit_price=220
            ),
        ]
        pr2 = PurchaseRequest(
            request_number=f"PR-{today.year}-0002",
            title="Quarterly office supplies",
            department="Operations",
            status=RequestStatus.submitted,
            needed_by=today + timedelta(days=10),
            requester_id=staff.id,
        )
        pr2.items = [
            PurchaseRequestItem(
                description="Printer paper (box)", quantity=40, unit="box",
                unit_price=35,
            ),
        ]
        db.add_all([pr, pr2])
        db.flush()

        # ---- Purchase Orders ----
        po = PurchaseOrder(
            po_number=f"PO-{today.year}-0001",
            status=OrderStatus.partially_received,
            currency="USD",
            order_date=today - timedelta(days=7),
            expected_date=today + timedelta(days=7),
            vendor_id=vendors[0].id,
            contract_id=contracts[2].id,
            created_by=manager.id,
        )
        po.items = [
            PurchaseOrderItem(
                description="Hydraulic Pump Model X", quantity=10, unit="unit",
                unit_price=4200, received_quantity=6,
            ),
            PurchaseOrderItem(
                description="Replacement Seal Kit", quantity=20, unit="kit",
                unit_price=85, received_quantity=20,
            ),
        ]
        po2 = PurchaseOrder(
            po_number=f"PO-{today.year}-0002",
            status=OrderStatus.issued,
            currency="USD",
            order_date=today - timedelta(days=2),
            expected_date=today + timedelta(days=14),
            vendor_id=vendors[1].id,
            created_by=manager.id,
        )
        po2.items = [
            PurchaseOrderItem(
                description="Annual SaaS License Seat", quantity=50, unit="seat",
                unit_price=240,
            ),
        ]
        db.add_all([po, po2])

        db.commit()
        print("Seeded demo data.")
        print("Login with:")
        print("  admin@moame.app   / admin123   (admin)")
        print("  manager@moame.app / manager123 (manager)")
        print("  staff@moame.app   / staff123   (staff)")
    finally:
        db.close()


if __name__ == "__main__":
    run()
