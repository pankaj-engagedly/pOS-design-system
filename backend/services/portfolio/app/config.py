"""Portfolio service configuration."""

from pos_contracts.config import BaseServiceConfig


class PortfolioConfig(BaseServiceConfig):
    SERVICE_NAME: str = "pos-portfolio"
    APP_SECRET_KEY: str = "change-me-in-production"
