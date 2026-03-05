"""Sample event publishers — demonstrates RabbitMQ integration."""

from pos_common.events import publish_event


async def emit_item_created(item_id: str, title: str):
    await publish_event("sample.item.created", {
        "item_id": item_id,
        "title": title,
    })


async def emit_item_updated(item_id: str, title: str):
    await publish_event("sample.item.updated", {
        "item_id": item_id,
        "title": title,
    })


async def emit_item_deleted(item_id: str):
    await publish_event("sample.item.deleted", {
        "item_id": item_id,
    })
