from datetime import datetime, timezone

from sqlalchemy.orm import Session
from sqlalchemy import func


def next_sequence(db: Session, model, column, prefix: str, width: int = 4) -> str:
    """Generate a human-friendly reference like ``VEN-0007`` or ``CON-2026-0003``.

    Counts existing rows whose value starts with ``prefix`` and increments.
    Not collision-proof under heavy concurrency, but fine for this app's scale.
    """
    count = (
        db.query(func.count())
        .select_from(model)
        .filter(column.like(f"{prefix}%"))
        .scalar()
        or 0
    )
    return f"{prefix}{count + 1:0{width}d}"


def year_prefix(base: str) -> str:
    return f"{base}-{datetime.now(timezone.utc):%Y}-"
