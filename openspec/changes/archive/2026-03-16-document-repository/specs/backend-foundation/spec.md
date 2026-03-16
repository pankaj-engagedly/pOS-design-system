## MODIFIED Requirements

### Requirement: API Gateway proxies to backend services

The API Gateway SHALL proxy requests to all backend services. It SHALL route `/api/documents/*` to the documents service at the configured DOCUMENTS_SERVICE_URL (default: http://localhost:8005). The gateway config SHALL include a DOCUMENTS_SERVICE_URL setting.

#### Scenario: Documents API proxy
- **WHEN** a request is made to /api/documents/folders
- **THEN** the gateway proxies it to http://localhost:8005/api/documents/folders with the X-User-Id header

#### Scenario: Gateway config includes documents service URL
- **WHEN** the gateway starts
- **THEN** GatewayConfig has DOCUMENTS_SERVICE_URL defaulting to "http://localhost:8005"

## ADDED Requirements

### Requirement: Documents service in dev-start script

The dev-start.sh script SHALL start the documents service on port 8005 with LOG_LEVEL support, matching the pattern used by other services. The Makefile SHALL pass a `documents` log level variable.

#### Scenario: Documents service starts with make dev
- **WHEN** a developer runs `make dev`
- **THEN** the documents service starts on port 8005 and logs to /tmp/pos-logs/documents.log

#### Scenario: Per-service log level
- **WHEN** a developer runs `make dev documents=TRACE`
- **THEN** the documents service starts with LOG_LEVEL=TRACE

### Requirement: Documents service health check in startup

The dev-start.sh script SHALL wait for the documents service health check (port 8005) during startup, matching the pattern used for other services.

#### Scenario: Startup waits for documents service
- **WHEN** `make dev` runs
- **THEN** it waits for http://localhost:8005/health to return OK before reporting ready
