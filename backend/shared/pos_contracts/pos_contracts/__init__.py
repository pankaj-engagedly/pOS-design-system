"""pos_contracts — shared contracts for pOS backend services.

Contains only types, schemas, and base models. Zero runtime infrastructure.
No database engines, no message broker connections, no HTTP clients.

Usage:
    from pos_contracts.models import Base, UserScopedBase
    from pos_contracts.config import BaseServiceConfig
    from pos_contracts.schemas import HealthResponse, PaginatedResponse
    from pos_contracts.exceptions import NotFoundError, AuthenticationError
"""

from .config import BaseServiceConfig
from .logging import setup_logging, trace
from .exceptions import (
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    PosError,
    ValidationError,
)
from .models import Base, UserScopedBase
from .schemas import ErrorResponse, HealthResponse, PaginatedResponse, PaginationParams

__all__ = [
    "Base",
    "UserScopedBase",
    "BaseServiceConfig",
    "HealthResponse",
    "ErrorResponse",
    "PaginationParams",
    "PaginatedResponse",
    "PosError",
    "AuthenticationError",
    "AuthorizationError",
    "NotFoundError",
    "ValidationError",
    "setup_logging",
    "trace",
]
