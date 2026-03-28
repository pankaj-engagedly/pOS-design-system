FROM python:3.12-slim

WORKDIR /app

# Shared libraries
COPY backend/shared/pos_contracts/ /shared/pos_contracts/
RUN pip install --no-cache-dir /shared/pos_contracts
COPY backend/shared/pos_events/ /shared/pos_events/
RUN pip install --no-cache-dir /shared/pos_events

# Service dependencies
COPY backend/services/notes/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code + migrations
COPY backend/services/notes/app/ app/
COPY backend/services/notes/alembic.ini .
COPY backend/services/notes/migrations/ migrations/

EXPOSE 8004
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8004"]
