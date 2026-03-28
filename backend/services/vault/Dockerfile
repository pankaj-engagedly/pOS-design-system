FROM python:3.12-slim

WORKDIR /app

# Shared libraries
COPY backend/shared/pos_contracts/ /shared/pos_contracts/
RUN pip install --no-cache-dir /shared/pos_contracts
COPY backend/shared/pos_events/ /shared/pos_events/
RUN pip install --no-cache-dir /shared/pos_events

# Service dependencies
COPY backend/services/vault/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code + migrations
COPY backend/services/vault/app/ app/
COPY backend/services/vault/alembic.ini .
COPY backend/services/vault/migrations/ migrations/

EXPOSE 8006
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8006"]
