from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app.routers import auth, users, vendors, contracts, procurement, dashboard

# Create tables on startup (simple approach; swap for Alembic in production).
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Backend API for managing vendors, contracts and procurement.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

prefix = settings.api_v1_prefix
app.include_router(auth.router, prefix=prefix)
app.include_router(users.router, prefix=prefix)
app.include_router(vendors.router, prefix=prefix)
app.include_router(contracts.router, prefix=prefix)
app.include_router(procurement.router, prefix=prefix)
app.include_router(dashboard.router, prefix=prefix)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "app": settings.app_name}


@app.get("/", tags=["meta"])
def root():
    return {
        "name": settings.app_name,
        "docs": "/docs",
        "api": settings.api_v1_prefix,
    }
