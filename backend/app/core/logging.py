"""구조화된 JSON 로깅 설정.

LOG_FORMAT 환경변수로 전환 가능:
- "json" (기본): Railway/Datadog 등 로그 수집기 친화적 JSON 출력
- "text": 로컬 개발용 일반 텍스트 출력
"""

import logging
import sys

from pythonjsonlogger.json import JsonFormatter

from app.core.config import settings


def setup_logging() -> None:
    log_format = getattr(settings, "LOG_FORMAT", "json")
    log_level = getattr(settings, "LOG_LEVEL", "INFO")

    root = logging.getLogger()
    root.setLevel(log_level)

    # 기존 핸들러 제거 (uvicorn 기본 핸들러 중복 방지)
    root.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)

    if log_format == "json":
        formatter = JsonFormatter(
            fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
            rename_fields={"asctime": "timestamp", "levelname": "level", "name": "logger"},
        )
    else:
        formatter = logging.Formatter(
            "%(asctime)s %(levelname)-5.5s [%(name)s] %(message)s",
            datefmt="%H:%M:%S",
        )

    handler.setFormatter(formatter)
    root.addHandler(handler)

    # SQLAlchemy 엔진 로그 축소
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    # uvicorn access 로그 유지
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
