"""Vault domain events using the declarative DomainEvent pattern."""

from pos_events import DomainEvent, event_bus


class VaultEvent(DomainEvent):
    _source_service = "vault"


CATEGORY_FIELDS = ("id", "user_id", "name", "icon")
CATEGORY_IDENTITY = ("id", "user_id")
ITEM_FIELDS = ("id", "user_id", "category_id", "name", "icon", "is_favorite")
ITEM_IDENTITY = ("id", "user_id")


class CategoryCreated(VaultEvent):
    _event_name = "vault.category.created"
    _payload_fields = CATEGORY_FIELDS


class CategoryUpdated(VaultEvent):
    _event_name = "vault.category.updated"
    _payload_fields = CATEGORY_FIELDS


class CategoryDeleted(VaultEvent):
    _event_name = "vault.category.deleted"
    _payload_fields = CATEGORY_IDENTITY


class ItemCreated(VaultEvent):
    _event_name = "vault.item.created"
    _payload_fields = ITEM_FIELDS


class ItemUpdated(VaultEvent):
    _event_name = "vault.item.updated"
    _payload_fields = ITEM_FIELDS


class ItemDeleted(VaultEvent):
    _event_name = "vault.item.deleted"
    _payload_fields = ITEM_IDENTITY


async def publish_category_event(event_name: str, category) -> None:
    event_map = {
        "vault.category.created": CategoryCreated,
        "vault.category.updated": CategoryUpdated,
        "vault.category.deleted": CategoryDeleted,
    }
    cls = event_map.get(event_name)
    if cls:
        await event_bus.publish(cls.from_model(category))


async def publish_item_event(event_name: str, item) -> None:
    event_map = {
        "vault.item.created": ItemCreated,
        "vault.item.updated": ItemUpdated,
        "vault.item.deleted": ItemDeleted,
    }
    cls = event_map.get(event_name)
    if cls:
        await event_bus.publish(cls.from_model(item))
