## MODIFIED Requirements

### Requirement: Gateway proxies to all backend services
The API gateway SHALL proxy requests for all registered backend services, including the attachment service.

#### Scenario: Attachment requests are proxied
- **WHEN** a request is made to `/api/attachments/{path}`
- **THEN** the gateway SHALL proxy it to the attachment service at `http://localhost:8003/api/attachments/{path}`

### Requirement: Dev scripts manage all services
The dev start/stop scripts and Makefile SHALL manage the attachment service lifecycle alongside auth, todos, and gateway.

#### Scenario: make dev starts attachment service
- **WHEN** `make dev` is run
- **THEN** the attachment service SHALL be started on port 8003 and its health checked

#### Scenario: make stop stops attachment service
- **WHEN** `make stop` is run
- **THEN** the attachment service process SHALL be stopped
