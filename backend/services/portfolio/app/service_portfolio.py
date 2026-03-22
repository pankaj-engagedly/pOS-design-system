"""Portfolio CRUD business logic."""

from uuid import UUID

from loguru import logger
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from pos_contracts.exceptions import NotFoundError

from .encryption import decrypt_pan, encrypt_pan, get_fernet, mask_pan
from .models import Portfolio, Transaction


async def create_portfolio(
    session: AsyncSession,
    user_id: UUID,
    app_secret: str,
    *,
    name: str,
    holder_name: str,
    pan: str | None = None,
    email: str | None = None,
    description: str | None = None,
) -> Portfolio:
    """Create a new portfolio container."""
    pan_encrypted = None
    if pan:
        fernet = get_fernet(app_secret, user_id)
        pan_encrypted = encrypt_pan(pan, fernet)

    portfolio = Portfolio(
        user_id=user_id,
        name=name,
        holder_name=holder_name,
        pan_encrypted=pan_encrypted,
        email=email,
        description=description,
    )
    session.add(portfolio)
    await session.commit()
    await session.refresh(portfolio)
    logger.info(f"Created portfolio '{name}' for user {user_id}")
    return portfolio


async def list_portfolios(session: AsyncSession, user_id: UUID) -> list[Portfolio]:
    """List all portfolios for a user."""
    result = await session.execute(
        select(Portfolio)
        .where(Portfolio.user_id == user_id)
        .order_by(Portfolio.holder_name, Portfolio.name)
    )
    return list(result.scalars().all())


async def get_portfolio(session: AsyncSession, user_id: UUID, portfolio_id: UUID) -> Portfolio:
    """Get a single portfolio by ID."""
    result = await session.execute(
        select(Portfolio).where(Portfolio.id == portfolio_id, Portfolio.user_id == user_id)
    )
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        raise NotFoundError("Portfolio not found")
    return portfolio


async def update_portfolio(
    session: AsyncSession,
    user_id: UUID,
    portfolio_id: UUID,
    app_secret: str,
    **kwargs,
) -> Portfolio:
    """Update a portfolio's fields."""
    portfolio = await get_portfolio(session, user_id, portfolio_id)

    # Handle PAN encryption if provided
    pan = kwargs.pop("pan", None)
    if pan is not None:
        fernet = get_fernet(app_secret, user_id)
        portfolio.pan_encrypted = encrypt_pan(pan, fernet) if pan else None

    for k, v in kwargs.items():
        if v is not None:
            setattr(portfolio, k, v)

    await session.commit()
    await session.refresh(portfolio)
    return portfolio


async def delete_portfolio(session: AsyncSession, user_id: UUID, portfolio_id: UUID) -> None:
    """Delete a portfolio and all associated data (cascade)."""
    portfolio = await get_portfolio(session, user_id, portfolio_id)
    await session.delete(portfolio)
    await session.commit()
    logger.info(f"Deleted portfolio {portfolio_id} for user {user_id}")


def get_pan_masked(portfolio: Portfolio, app_secret: str, user_id: UUID) -> str | None:
    """Decrypt and mask a portfolio's PAN."""
    if not portfolio.pan_encrypted:
        return None
    try:
        fernet = get_fernet(app_secret, user_id)
        pan = decrypt_pan(portfolio.pan_encrypted, fernet)
        return mask_pan(pan)
    except Exception:
        return "****"


def get_pan_decrypted(portfolio: Portfolio, app_secret: str, user_id: UUID) -> str | None:
    """Decrypt a portfolio's PAN (for CAS password usage)."""
    if not portfolio.pan_encrypted:
        return None
    try:
        fernet = get_fernet(app_secret, user_id)
        return decrypt_pan(portfolio.pan_encrypted, fernet)
    except Exception:
        return None
