"""Vault domain events using the declarative DomainEvent pattern."""

from pos_events import DomainEvent, event_bus


class VaultEvent(DomainEvent):
    _source_service = "vault"


ITEM_FIELDS = ("id", "user_id", "name", "icon", "is_favorite")
ITEM_IDENTITY = ("id", "user_id")
FIELD_FIELDS = ("id", "user_id", "vault_item_id", "field_name", "field_type")
FIELD_IDENTITY = ("id", "user_id")


class ItemCreated(VaultEvent):
    _event_name = "vault.item.created"
    _payload_fields = ITEM_FIELDS


class ItemUpdated(VaultEvent):
    _event_name = "vault.item.updated"
    _payload_fields = ITEM_FIELDS


class ItemDeleted(VaultEvent):
    _event_name = "vault.item.deleted"
    _payload_fields = ITEM_IDENTITY


class FieldAdded(VaultEvent):
    _event_name = "vault.field.added"
    _payload_fields = FIELD_FIELDS


class FieldUpdated(VaultEvent):
    _event_name = "vault.field.updated"
    _payload_fields = FIELD_FIELDS


class FieldDeleted(VaultEvent):
    _event_name = "vault.field.deleted"
    _payload_fields = FIELD_IDENTITY


async def publish_item_event(event_name: str, item) -> None:
    event_map = {
        "vault.item.created": ItemCreated,
        "vault.item.updated": ItemUpdated,
        "vault.item.deleted": ItemDeleted,
    }
    cls = event_map.get(event_name)
    if cls:
        await event_bus.publish(cls.from_model(item))


async def publish_field_event(event_name: str, field) -> None:
    event_map = {
        "vault.field.added": FieldAdded,
        "vault.field.updated": FieldUpdated,
        "vault.field.deleted": FieldDeleted,
    }
    cls = event_map.get(event_name)
    if cls:
        await event_bus.publish(cls.from_model(field))
