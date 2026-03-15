"""EventBus — the single interface services use for event publishing.

Why use the bus instead of the transport directly?
Services call event_bus.publish(event). They don't know or care whether
the transport is RabbitMQ, Kafka, or a test double. This is the same
principle as the Ruby gem pattern: one publish method, transport hidden.

The bus is best-effort by design: if RabbitMQ is down, the request
still succeeds and we log a warning. Domain operations (saving to DB)
are not coupled to event delivery.

Lifecycle in a service's main.py:
    @asynccontextmanager
    async def lifespan(app):
        await event_bus.init(config.RABBITMQ_URL)
        yield
        await event_bus.close()
"""

from typing import Callable

from loguru import logger

from .base import BaseEvent
from .transport import Transport


class EventBus:
    """Async event bus with pluggable transport and best-effort publishing."""

    def __init__(self):
        self._transport: Transport | None = None

    async def init(self, url: str, transport: Transport | None = None) -> None:
        """Connect to the event broker.

        Args:
            url: Broker URL (e.g. amqp://guest:guest@localhost:5672/)
            transport: Optional transport override. Defaults to RabbitMqTransport.
                       Pass a custom transport for testing or broker migrations.
        """
        if transport is None:
            from .rabbitmq import RabbitMqTransport
            transport = RabbitMqTransport()

        try:
            await transport.connect(url)
            self._transport = transport
        except Exception as e:
            # Best-effort: services run without events if broker is unavailable
            logger.warning("Event bus unavailable, events disabled: {}", e)
            self._transport = None

    async def publish(self, event: BaseEvent) -> None:
        """Publish an event. Best-effort — failures are logged, not raised."""
        if self._transport is None:
            return

        try:
            await self._transport.publish(event)
        except Exception as e:
            logger.warning("Failed to publish {}: {}", event.event_name, e)

    async def subscribe(self, pattern: str, handler: Callable) -> None:
        """Subscribe to events matching a routing key pattern."""
        if self._transport is None:
            logger.warning("Event bus not initialized, subscription '{}' skipped", pattern)
            return

        await self._transport.subscribe(pattern, handler)

    async def close(self) -> None:
        """Close the broker connection."""
        if self._transport is not None:
            await self._transport.close()
            self._transport = None


# Module-level singleton — import and use directly in services:
#   from pos_events import event_bus
#   await event_bus.publish(NoteCreated(...))
event_bus = EventBus()
