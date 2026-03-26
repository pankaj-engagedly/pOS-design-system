"""Category CRUD and seed data for expense tracker."""

from uuid import UUID

from loguru import logger
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from pos_contracts.exceptions import NotFoundError

from .models import Category, CategoryRule


# ── Seed taxonomy ────────────────────────────────────────

SEED_CATEGORIES = [
    # (group_type, name, icon, children)
    ("income", "Income", None, [
        "Salary", "Freelance/Business", "Interest", "Dividends",
        "Rental Income", "Refunds", "Cashback",
    ]),
    ("expense", "Food & Dining", None, [
        "Groceries", "Restaurants", "Food Delivery", "Coffee/Snacks",
    ]),
    ("expense", "Housing", None, [
        "Rent", "Society Maintenance", "Home Repairs", "Furnishing", "Property Tax",
    ]),
    ("expense", "Utilities", None, [
        "Electricity", "Water", "Gas", "Internet/Broadband", "Mobile", "DTH/Cable",
    ]),
    ("expense", "Transport", None, [
        "Fuel/Petrol", "Cab/Auto", "Metro/Bus/Train", "Parking/Toll",
        "Vehicle Maintenance", "Vehicle Insurance",
    ]),
    ("expense", "Shopping", None, [
        "Clothing", "Electronics", "Online Shopping", "Household Supplies",
    ]),
    ("expense", "Health", None, [
        "Doctor/Medical", "Pharmacy", "Lab Tests", "Gym/Fitness", "Health Insurance",
    ]),
    ("expense", "Education", None, [
        "School/College Fees", "Books", "Online Courses", "Coaching",
    ]),
    ("expense", "Entertainment", None, [
        "Movies/Events", "OTT Subscriptions", "Games/Hobbies", "Music",
    ]),
    ("expense", "Travel", None, [
        "Flights", "Hotels", "Train/Bus", "Travel Insurance",
    ]),
    ("expense", "Personal Care", None, [
        "Salon/Grooming", "Spa/Wellness",
    ]),
    ("expense", "Family", None, [
        "Domestic Help", "Kids", "Gifts", "Family Support",
    ]),
    ("expense", "Financial", None, [
        "EMI Payments", "Loan Interest", "Bank Charges", "Life Insurance",
    ]),
    ("expense", "Government/Tax", None, [
        "Income Tax", "GST/Professional Tax", "Stamp Duty", "Fines",
    ]),
    ("expense", "Donations", None, [
        "Charity", "Religious", "Political",
    ]),
    ("expense", "Cash", None, [
        "ATM Withdrawal", "Cash Payment",
    ]),
    ("transfer", "Transfers", None, [
        "Self Transfer", "CC Bill Payment", "Wallet Top-up",
    ]),
    ("investment", "Investment", None, [
        "MF/Stocks/FD/PPF/NPS", "Investment Income",
    ]),
]

SEED_RULES = [
    # (keyword, category_path)  — category_path is "Parent > Child" or just "Child"
    ("swiggy", "Food Delivery"), ("zomato", "Food Delivery"), ("dominos", "Food Delivery"),
    ("mcd", "Food Delivery"), ("kfc", "Food Delivery"), ("uber eats", "Food Delivery"),
    ("bigbasket", "Groceries"), ("blinkit", "Groceries"), ("zepto", "Groceries"),
    ("dmart", "Groceries"), ("more retail", "Groceries"), ("nature basket", "Groceries"),
    ("amazon", "Online Shopping"), ("flipkart", "Online Shopping"), ("myntra", "Online Shopping"),
    ("ajio", "Online Shopping"), ("meesho", "Online Shopping"), ("nykaa", "Online Shopping"),
    ("uber", "Cab/Auto"), ("ola", "Cab/Auto"), ("rapido", "Cab/Auto"),
    ("irctc", "Train/Bus"), ("redbus", "Train/Bus"), ("makemytrip", "Travel"),
    ("airtel", "Mobile"), ("jio", "Mobile"), ("vodafone", "Mobile"), ("bsnl", "Mobile"),
    ("bescom", "Electricity"), ("tata power", "Electricity"),
    ("netflix", "OTT Subscriptions"), ("hotstar", "OTT Subscriptions"),
    ("spotify", "OTT Subscriptions"), ("prime video", "OTT Subscriptions"),
    ("youtube premium", "OTT Subscriptions"),
    ("bookmyshow", "Movies/Events"),
    ("shell", "Fuel/Petrol"), ("hp petrol", "Fuel/Petrol"), ("indian oil", "Fuel/Petrol"),
    ("bpcl", "Fuel/Petrol"),
    ("apollo", "Doctor/Medical"), ("1mg", "Pharmacy"), ("pharmeasy", "Pharmacy"),
    ("medplus", "Pharmacy"),
    ("zerodha", "MF/Stocks/FD/PPF/NPS"), ("groww", "MF/Stocks/FD/PPF/NPS"),
    ("kuvera", "MF/Stocks/FD/PPF/NPS"), ("coin", "MF/Stocks/FD/PPF/NPS"),
    ("paytm", "Wallet Top-up"), ("phonepe", "Wallet Top-up"),
    ("society maintenance", "Society Maintenance"), ("maintenance charges", "Society Maintenance"),
    ("rent", "Rent"),
    ("atm", "ATM Withdrawal"), ("cash withdrawal", "ATM Withdrawal"),
]


async def seed_categories(session: AsyncSession, user_id: UUID) -> int:
    """Seed default categories and rules for a new user. Idempotent — skips if categories exist."""
    existing = await session.execute(
        select(func.count(Category.id)).where(Category.user_id == user_id)
    )
    if existing.scalar() > 0:
        return 0

    # Build category name → id lookup as we create
    name_to_id: dict[str, UUID] = {}
    sort = 0

    for group_type, parent_name, icon, children in SEED_CATEGORIES:
        parent = Category(
            user_id=user_id,
            name=parent_name,
            icon=icon,
            is_system=True,
            sort_order=sort,
            group_type=group_type,
        )
        session.add(parent)
        await session.flush()
        name_to_id[parent_name] = parent.id
        sort += 1

        for child_name in children:
            child = Category(
                user_id=user_id,
                name=child_name,
                parent_id=parent.id,
                is_system=True,
                sort_order=sort,
                group_type=group_type,
            )
            session.add(child)
            await session.flush()
            name_to_id[child_name] = child.id
            sort += 1

    # Seed rules
    for keyword, category_name in SEED_RULES:
        cat_id = name_to_id.get(category_name)
        if cat_id:
            rule = CategoryRule(
                user_id=user_id,
                keyword=keyword,
                category_id=cat_id,
                source="system",
            )
            session.add(rule)

    await session.commit()
    logger.info(f"Seeded {sort} categories and {len(SEED_RULES)} rules for user {user_id}")
    return sort


# ── CRUD ─────────────────────────────────────────────────


async def get_category_tree(session: AsyncSession, user_id: UUID) -> list[Category]:
    """Return all categories for a user (flat list — frontend builds the tree)."""
    result = await session.execute(
        select(Category)
        .where(Category.user_id == user_id)
        .order_by(Category.sort_order)
    )
    return list(result.scalars().all())


async def create_category(
    session: AsyncSession, user_id: UUID, *, name: str, parent_id: UUID | None = None,
    icon: str | None = None, group_type: str = "expense", sort_order: int = 0,
) -> Category:
    cat = Category(
        user_id=user_id, name=name, parent_id=parent_id,
        icon=icon, is_system=False, sort_order=sort_order, group_type=group_type,
    )
    session.add(cat)
    await session.commit()
    await session.refresh(cat)
    return cat


async def update_category(
    session: AsyncSession, user_id: UUID, category_id: UUID, **kwargs,
) -> Category:
    result = await session.execute(
        select(Category).where(Category.id == category_id, Category.user_id == user_id)
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise NotFoundError("Category not found")
    for k, v in kwargs.items():
        if v is not None:
            setattr(cat, k, v)
    await session.commit()
    await session.refresh(cat)
    return cat


async def delete_category(session: AsyncSession, user_id: UUID, category_id: UUID) -> None:
    result = await session.execute(
        select(Category).where(Category.id == category_id, Category.user_id == user_id)
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise NotFoundError("Category not found")
    await session.delete(cat)
    await session.commit()
