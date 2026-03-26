"""Expense Tracker service configuration."""

from pos_contracts.config import BaseServiceConfig


class ExpenseTrackerConfig(BaseServiceConfig):
    SERVICE_NAME: str = "pos-expense-tracker"
