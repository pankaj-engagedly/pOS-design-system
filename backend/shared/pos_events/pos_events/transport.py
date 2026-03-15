"""Transport ABC — pluggable message broker backend.

Why an abstraction over the broker directly?
Services call event_bus.publish(event) — they never touch the transport.
This means the broker can be swapped (or dual-published during migration)
without changing a single line of service code.

Real-world example: migrating from ResqueBus (Redis) to RabbitMQ:
1. Implement RabbitMqTransport (this pattern)
2. Create FanoutTransport([resquebus_transport, rabbitmq_transport])
3. Migrate subscribers to RabbitMQ one at a time
4. Remove FanoutTransport when all subscribers are migrated
No service code changes at any step.

Available implementations:
    RabbitMqTransport — default, uses aio-pika
    (Future) FanoutTransport — dual-publish to multiple backends
    (Future) NullTransport  — no-op, useful for tests
"""

from abc import ABC, abstractmethod
from typing import Callable

from .base import BaseEvent


class Transport(ABC):
    """Abstract message broker backend.

    Implement this to support a new event transport (Kafka, SQS, etc.).
    """

    @abstractmethod
    async def connect(self, url: str) -> None:
        """Establish connection to the broker."""
        ...

    @abstractmethod
    async def publish(self, event: BaseEvent) -> None:
        """Publish an event to the broker."""
        ...

    @abstractmethod
    async def subscribe(self, pattern: str, handler: Callable) -> None:
        """Subscribe to events matching a routing key pattern.

        Args:
            pattern: Routing key pattern (e.g. 'note.*', 'todo.#')
            handler: Async callable(routing_key: str, data: dict)
        """
        ...

    @abstractmethod
    async def close(self) -> None:
        """Close broker connection and release resources."""
        ...
