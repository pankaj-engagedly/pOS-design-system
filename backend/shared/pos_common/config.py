"""Configuration module using Pydantic Settings."""

from pydantic_settings import BaseSettings


class BaseServiceConfig(BaseSettings):
    """Base configuration for all pOS services.

    Loads from environment variables and .env files.
    Subclass in each service to add service-specific settings.
    """

    SERVICE_NAME: str = "pos-service"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://pos:pos@localhost:5432/pos"

    # RabbitMQ
    RABBITMQ_URL: str = "amqp://guest:guest@localhost:5672/"

    # JWT
    JWT_SECRET_KEY: str = "dev-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }
