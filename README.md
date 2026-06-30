# Moame — Contracts & Procurement Management

A full-stack web application for managing **vendors**, **contracts**, **purchase
requests**, and **purchase orders**, with a KPI dashboard and reporting.

- **Backend:** Python · FastAPI · SQLAlchemy 2 · JWT auth · SQLite (Postgres-ready)
- **Frontend:** React 18 · TypeScript · Vite · React Router · Recharts

---

## Features

| Module | Capabilities |
| --- | --- |
| **Dashboard** | KPI cards (active contracts, expiring soon, open POs, pending requests), top-vendor spend bar chart, contracts-by-status pie chart, and an "expiring in 60 days" table. |
| **Contracts** | Full CRUD, auto-numbered (`CON-YYYY-NNNN`), vendor & owner links, value/currency, start/end/renewal dates, auto-renew flag, status workflow, expiry countdown, search & filters. |
| **Purchase Requests** | CRUD with editable line items, auto-numbered (`PR-YYYY-NNNN`), departments, justification, approval status, and **one-click conversion to a Purchase Order**. |
| **Purchase Orders** | CRUD with line items and **received-quantity tracking**; status auto-syncs (issued → partially received → received); links to vendor & contract; delivery progress bar. |
| **Vendors** | CRUD, auto-numbered (`VEN-NNNN`), categories, contacts, ratings, status (active/inactive/blacklisted/pending), and linked contract/PO counts. |
| **Users & Roles** | Admin-only user management with three roles: `admin`, `manager`, `staff`. JWT-based authentication. |

---

## Project structure

```
Moame/
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── core/            # config, database, security, utils
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── routers/         # API endpoints
│   │   ├── deps.py          # auth dependencies
│   │   ├── seed.py          # demo data loader
│   │   └── main.py          # app entrypoint
│   ├── tests/               # pytest API tests
│   └── requirements.txt
└── frontend/                # React + Vite app
    └── src/
        ├── api/             # fetch client
        ├── components/      # Layout, Modal, shared UI
        ├── context/         # auth context
        ├── pages/           # one file per screen
        └── types/           # shared TypeScript types
```

---

## Running locally

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# (optional) load demo data + demo users
python -m app.seed

# start the API on http://localhost:8000  (docs at /docs)
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173 (proxies /api to :8000)
```

Open <http://localhost:5173> and sign in.

### Demo accounts (after running the seed)

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@moame.app` | `admin123` |
| Manager | `manager@moame.app` | `manager123` |
| Staff | `staff@moame.app` | `staff123` |

---

## Configuration

Backend settings are read from environment variables / a `.env` file in
`backend/` (see `backend/.env.example`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `SECRET_KEY` | dev placeholder | JWT signing key — **set this in production** |
| `DATABASE_URL` | `sqlite:///./moame.db` | Any SQLAlchemy URL (e.g. Postgres) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Token lifetime |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Comma-separated allowed origins |

---

## Tests

```bash
cd backend
source .venv/bin/activate
pytest
```

The suite covers auth, vendor CRUD with auto-coding, the contract/dashboard
flow, and request-to-order conversion.

---

## Notes for production

- Tables are auto-created on startup for convenience. For real deployments,
  switch to **Alembic** migrations and a managed database (Postgres).
- Set a strong `SECRET_KEY` and lock down `CORS_ORIGINS`.
- Build the frontend with `npm run build` and serve the `dist/` folder behind
  your reverse proxy, or host it separately and point it at the API.
