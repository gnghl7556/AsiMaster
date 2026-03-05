"""커스텀 애플리케이션 예외.

서비스 레이어에서 HTTP 프레임워크 의존 없이 에러를 표현하기 위한 예외 클래스.
"""


class AppError(Exception):
    """기본 애플리케이션 예외."""
    pass


class NotFoundError(AppError):
    """리소스를 찾을 수 없음 (404)."""
    pass


class DuplicateError(AppError):
    """중복 리소스 (409)."""
    pass
