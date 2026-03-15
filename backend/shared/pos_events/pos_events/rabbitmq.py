"""RabbitMQ transport — default implementation using aio-pika.

Uses a durable topic exchange 'pos.events'. Event routing keys (dot-notation)
map directly to AMQP routing keys, enabling flexible subscription patterns:
    'note.*'   — all note events
    'note.#'   — all note events including nested (note.tag.added)
    '#'        — everything (useful for logging/audit service)
"""

import json
from typing import Callable

import aio_pika
from loguru import logger

from .base import BaseEvent
from .transport import Transport

EXCHANGE_NAME = "pos.events"


class RabbitMqTransport(Transport):
    """aio-pika backed transport for the pos.events topic exchange."""

    def __init__(self):
        self._connection = None
        self._channel = None
        self._exchange = None

    async def connect(self, url: str) -> None:
        self._connection = await aio_pika.connect_robust(url)
        self._channel = await self._connection.channel()
        self._exchange = await self._channel.declare_exchange(
            EXCHANGE_NAME,
            aio_pika.ExchangeType.TOPIC,
            durable=True,
        )
        logger.info("RabbitMQ connected — exchange '{}' ready", EXCHANGE_NAME)

    async def publish(self, event: BaseEvent) -> None:
        if self._exchange is None:
            raise RuntimeError("RabbitMqTransport not connected. Call connect() first.")

        message = aio_pika.Message(
            body=json.dumps(event.to_dict()).encode(),
            content_type="application/json",
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
        )
        await self._exchange.publish(message, routing_key=event.event_name)
        logger.debug("Published {} from {}", event.event_name, event.source_service)

    async def subscribe(self, pattern: str, handler: Callable) -> None:
        if self._channel is None:
            raise RuntimeError("RabbitMqTransport not connected. Call connect() first.")

        queue = await self._channel.declare_queue("", exclusive=True)
        await queue.bind(self._exchange, routing_key=pattern)

        async def on_message(message: aio_pika.IncomingMessage):
            async with message.process():
                data = json.loads(message.body.decode())
                await handler(message.routing_key, data)

        await queue.consume(on_message)
        logger.info("Subscribed to pattern '{}'", pattern)

    async def close(self) -> None:
        if self._connection:
            await self._connection.close()
            self._connection = None
            self._channel = None
            self._exchange = None
            logger.info("RabbitMQ connection closed")
