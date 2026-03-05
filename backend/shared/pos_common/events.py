"""RabbitMQ event helpers — publish and subscribe using aio-pika."""

import json
import logging

import aio_pika

logger = logging.getLogger(__name__)

EXCHANGE_NAME = "pos.events"

_connection = None
_channel = None
_exchange = None


async def init_events(rabbitmq_url: str):
    """Initialize RabbitMQ connection and declare the topic exchange."""
    global _connection, _channel, _exchange

    _connection = await aio_pika.connect_robust(rabbitmq_url)
    _channel = await _connection.channel()
    _exchange = await _channel.declare_exchange(
        EXCHANGE_NAME,
        aio_pika.ExchangeType.TOPIC,
        durable=True,
    )
    logger.info("Connected to RabbitMQ, exchange '%s' ready", EXCHANGE_NAME)


async def publish_event(routing_key: str, data: dict):
    """Publish an event to the pos.events topic exchange.

    Args:
        routing_key: Dot-notation key (e.g., 'todo.created', 'note.updated')
        data: JSON-serializable dict payload
    """
    if _exchange is None:
        raise RuntimeError("Events not initialized. Call init_events() first.")

    message = aio_pika.Message(
        body=json.dumps(data).encode(),
        content_type="application/json",
        delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
    )
    await _exchange.publish(message, routing_key=routing_key)
    logger.debug("Published event %s: %s", routing_key, data)


async def subscribe(pattern: str, handler):
    """Subscribe to events matching a routing key pattern.

    Args:
        pattern: Routing key pattern (e.g., 'todo.*', 'kb.item.#')
        handler: Async callback(routing_key: str, data: dict)
    """
    if _channel is None:
        raise RuntimeError("Events not initialized. Call init_events() first.")

    queue = await _channel.declare_queue("", exclusive=True)
    await queue.bind(_exchange, routing_key=pattern)

    async def on_message(message: aio_pika.IncomingMessage):
        async with message.process():
            data = json.loads(message.body.decode())
            await handler(message.routing_key, data)

    await queue.consume(on_message)
    logger.info("Subscribed to pattern '%s'", pattern)


async def close_events():
    """Close the RabbitMQ connection."""
    global _connection, _channel, _exchange
    if _connection:
        await _connection.close()
        _connection = None
        _channel = None
        _exchange = None
