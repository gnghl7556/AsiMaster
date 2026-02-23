from datetime import datetime, timezone


def utcnow() -> datetime:
    """timezone-aware UTC now를 naive datetime으로 변환 (DB 호환)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
