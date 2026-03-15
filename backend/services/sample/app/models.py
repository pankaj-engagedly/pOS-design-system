"""Sample models — demonstrates UserScopedBase usage."""

from sqlalchemy import Column, String, Text

from pos_contracts.models import UserScopedBase


class SampleItem(UserScopedBase):
    """Example model. Replace with your domain model."""

    __tablename__ = "sample_items"

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
