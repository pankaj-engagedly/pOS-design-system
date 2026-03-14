## ADDED Requirements

### Requirement: BaseEvent envelope with enforced structure

The `pos_events` package SHALL provide a `BaseEvent` dataclass that defines the standard envelope for all domain events. Every event SHALL include: `event_id` (UUIDv7, auto-generated), `event_name` (dot-notation string, e.g., `"note.created"`), `source_service` (string identifying the publishing service), `created_at` (ISO 8601 UTC timestamp, auto-generated), and `payload` (dict with service-specific data).

#### Scenario: BaseEvent auto-generates envelope fields
- **WHEN** a service creates `BaseEvent(event_name="note.created", source_service="notes", payload={"note_id": "123"})`
- **THEN** `event_id` is a valid UUIDv7 string
- **AND** `created_at` is an ISO 8601 UTC timestamp
- **AND** `event_name`, `source_service`, and `payload` match the provided values

#### Scenario: BaseEvent serializes to dict
- **WHEN** `event.to_dict()` is called on a BaseEvent instance
- **THEN** it returns a dict with keys: `event_id`, `event_name`, `source_service`, `created_at`, `payload`
- **AND** all values are JSON-serializable

### Requirement: Concrete events extend BaseEvent

Services SHALL define concrete event classes that extend `BaseEvent`, providing their `event_name`, `source_service`, and structured `payload`. Concrete event classes SHALL live in each service's codebase, NOT in the shared package.

#### Scenario: NoteCreated event in notes service
- **WHEN** the notes service defines `class NoteCreated(BaseEvent)` with `event_name="note.created"` and payload containing `note_id`, `title`, `folder_id`
- **THEN** `NoteCreated(note_id="abc", title="My Note", folder_id="def")` produces a valid BaseEvent with the correct envelope and payload

#### Scenario: Concrete events are not in the shared package
- **WHEN** a developer inspects the `pos_events` package source
- **THEN** it contains NO concrete event classes (no `NoteCreated`, `TaskCompleted`, etc.)
- **AND** only `BaseEvent`, `Transport`, `EventBus`, and transport implementations

### Requirement: Transport ABC for pluggable backends

The `pos_events` package SHALL define a `Transport` abstract base class with async methods: `connect(url)`, `publish(event)`, `subscribe(pattern, handler)`, and `close()`. This abstraction SHALL allow swapping the message broker without changing service code.

#### Scenario: Transport defines required interface
- **WHEN** a developer creates a new transport class
- **THEN** they MUST implement `connect`, `publish`, `subscribe`, and `close` methods
- **AND** attempting to instantiate a Transport subclass without implementing all methods raises `TypeError`

#### Scenario: Transport is swappable
- **WHEN** the EventBus is initialized with `RabbitMqTransport()`
- **AND** later re-initialized with a different `Transport` implementation
- **THEN** service code calling `event_bus.publish(event)` works identically with both transports

### Requirement: RabbitMQ transport implementation

The `pos_events` package SHALL provide a `RabbitMqTransport` class implementing the `Transport` ABC using aio-pika. It SHALL connect to RabbitMQ, declare a durable topic exchange named `pos.events`, and publish/subscribe using routing keys matching the event name.

#### Scenario: RabbitMqTransport connects and publishes
- **WHEN** `RabbitMqTransport.connect("amqp://guest:guest@localhost:5672/")` is called
- **AND** `transport.publish(event)` is called with a BaseEvent
- **THEN** a persistent message is published to the `pos.events` topic exchange
- **AND** the routing key matches `event.event_name`
- **AND** the message body is the JSON-serialized `event.to_dict()`

#### Scenario: RabbitMqTransport subscribes to patterns
- **WHEN** `transport.subscribe("note.*", handler)` is called
- **THEN** a queue is created and bound to the `pos.events` exchange with routing pattern `"note.*"`
- **AND** the handler is invoked with the deserialized event dict for matching messages

#### Scenario: RabbitMqTransport cleans up on close
- **WHEN** `transport.close()` is called
- **THEN** the RabbitMQ connection is closed
- **AND** no resource leaks remain

### Requirement: EventBus singleton for service interaction

The `pos_events` package SHALL provide an `EventBus` class and a module-level singleton `event_bus`. Services SHALL interact only with this singleton — never with transports directly. The EventBus SHALL support best-effort publishing (log warnings on failure, do not fail the request).

#### Scenario: EventBus initializes with default transport
- **WHEN** `await event_bus.init(url)` is called without specifying a transport
- **THEN** the EventBus uses `RabbitMqTransport` as the default

#### Scenario: EventBus initializes with custom transport
- **WHEN** `await event_bus.init(url, transport=CustomTransport())` is called
- **THEN** the EventBus uses the provided transport

#### Scenario: EventBus publishes best-effort
- **WHEN** `await event_bus.publish(event)` is called
- **AND** the transport fails (e.g., RabbitMQ is down)
- **THEN** the failure is logged as a warning
- **AND** the calling code does NOT receive an exception

#### Scenario: EventBus gracefully handles missing initialization
- **WHEN** `await event_bus.publish(event)` is called before `init()` or after `close()`
- **THEN** the publish is silently skipped (no error)

#### Scenario: EventBus closes cleanly
- **WHEN** `await event_bus.close()` is called
- **THEN** the underlying transport is closed
- **AND** subsequent publish calls are silently skipped

### Requirement: Package is installable independently

The `pos_events` package (`backend/shared/pos_events/`) SHALL be installable via `pip install -e backend/shared/pos_events`. It SHALL depend on `aio-pika` and `pos_contracts` (for UUIDv7 via uuid-utils). It SHALL NOT depend on SQLAlchemy, FastAPI, or any service-specific code.

#### Scenario: Package installs with correct dependencies
- **WHEN** `pip install -e backend/shared/pos_events` is run
- **THEN** `aio-pika` is installed as a dependency
- **AND** `from pos_events import BaseEvent, EventBus, event_bus, Transport, RabbitMqTransport` succeeds
