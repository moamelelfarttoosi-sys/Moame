import os
import tempfile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Use a throwaway SQLite file for the test run.
_fd, _db_path = tempfile.mkstemp(suffix=".db")
os.environ["DATABASE_URL"] = f"sqlite:///{_db_path}"

from app.core.database import Base, get_db  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.main import app  # noqa: E402

engine = create_engine(
    os.environ["DATABASE_URL"], connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    db.add(
        User(
            email="admin@test.app",
            full_name="Admin",
            role=UserRole.admin,
            hashed_password=hash_password("secret"),
        )
    )
    db.commit()
    db.close()
    yield


client = TestClient(app)


def auth_header():
    resp = client.post(
        "/api/v1/auth/login/json",
        json={"email": "admin@test.app", "password": "secret"},
    )
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def test_health():
    assert client.get("/health").json()["status"] == "ok"


def test_requires_auth():
    assert client.get("/api/v1/vendors").status_code == 401


def test_vendor_crud_and_autocode():
    h = auth_header()
    resp = client.post("/api/v1/vendors", json={"name": "Test Vendor"}, headers=h)
    assert resp.status_code == 201, resp.text
    vendor = resp.json()
    assert vendor["code"].startswith("VEN-")

    listed = client.get("/api/v1/vendors", headers=h).json()
    assert len(listed) == 1


def test_contract_lifecycle_and_dashboard():
    h = auth_header()
    vendor_id = client.get("/api/v1/vendors", headers=h).json()[0]["id"]
    resp = client.post(
        "/api/v1/contracts",
        json={
            "title": "Test Contract",
            "value": 1000,
            "status": "active",
            "vendor_id": vendor_id,
            "end_date": "2099-01-01",
        },
        headers=h,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["vendor_name"] == "Test Vendor"

    summary = client.get("/api/v1/dashboard/summary", headers=h).json()
    assert summary["contracts"]["active"] == 1


def test_purchase_request_convert_to_order():
    h = auth_header()
    resp = client.post(
        "/api/v1/requests",
        json={
            "title": "Need supplies",
            "status": "approved",
            "items": [{"description": "Widget", "quantity": 3, "unit_price": 10}],
        },
        headers=h,
    )
    assert resp.status_code == 201, resp.text
    req = resp.json()
    assert req["estimated_total"] == 30

    convert = client.post(f"/api/v1/requests/{req['id']}/convert", headers=h)
    assert convert.status_code == 200, convert.text
    order = convert.json()
    assert order["total_amount"] == 30
    assert len(order["items"]) == 1
