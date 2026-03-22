"""Configuration base class for all pOS services.

Each service subclasses BaseServiceConfig to add service-specific settings.
The base class defines only settings common to all services.
"""

from pydantic_settings import BaseSettings


class BaseServiceConfig(BaseSettings):
    """Base configuration for all pOS services.

    Loads from environment variables and .env files.
    Subclass in each service to add service-specific settings:

        class NotesConfig(BaseServiceConfig):
            SERVICE_NAME: str = "pos-notes"
            # notes-specific settings here
    """

    SERVICE_NAME: str = "pos-service"
    DEBUG: bool = False

    # Logging — controls loguru output level.
    # TRACE: full function entry/exit tracing (learning/debugging)
    # DEBUG: detailed internal state
    # INFO:  production default (startup, requests, events)
    # WARNING/ERROR: problems only
    LOG_LEVEL: str = "INFO"

    # Database — each service connects to its own schema/tables within the shared DB.
    # In future phases, different services may use different DATABASE_URLs entirely.
    DATABASE_URL: str = "postgresql+asyncpg://pos:pos@localhost:5432/pos"

    # RabbitMQ — event bus transport URL
    RABBITMQ_URL: str = "amqp://guest:guest@localhost:5672/"

    # JWT — only the gateway and auth service use these directly.
    # Other services trust the X-User-Id header set by the gateway.
    JWT_SECRET_KEY: str = "dev-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }
