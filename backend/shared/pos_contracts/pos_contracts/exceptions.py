"""Common exception hierarchy with HTTP status code mappings.

All pOS domain exceptions extend PosError. Each carries a status_code so
FastAPI exception handlers can return the correct HTTP response.
"""


class PosError(Exception):
    """Base exception for all pOS errors."""

    status_code: int = 500
    detail: str = "Internal server error"

    def __init__(self, detail: str | None = None):
        self.detail = detail or self.__class__.detail
        super().__init__(self.detail)


class AuthenticationError(PosError):
    """Raised when authentication fails (invalid/expired token)."""

    status_code = 401
    detail = "Not authenticated"


class AuthorizationError(PosError):
    """Raised when user lacks permission for the requested action."""

    status_code = 403
    detail = "Not authorized"


class NotFoundError(PosError):
    """Raised when a requested resource does not exist."""

    status_code = 404
    detail = "Resource not found"


class ValidationError(PosError):
    """Raised when input validation fails."""

    status_code = 422
    detail = "Validation error"
