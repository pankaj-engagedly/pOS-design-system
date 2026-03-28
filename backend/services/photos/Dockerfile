FROM python:3.12-slim

WORKDIR /app

# System dependencies for Pillow (image processing) and ffmpeg (video thumbnails)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg libjpeg62-turbo-dev zlib1g-dev && \
    rm -rf /var/lib/apt/lists/*

# Shared libraries
COPY backend/shared/pos_contracts/ /shared/pos_contracts/
RUN pip install --no-cache-dir /shared/pos_contracts
COPY backend/shared/pos_events/ /shared/pos_events/
RUN pip install --no-cache-dir /shared/pos_events

# Service dependencies
COPY backend/services/photos/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code + migrations
COPY backend/services/photos/app/ app/
COPY backend/services/photos/alembic.ini .
COPY backend/services/photos/migrations/ migrations/

EXPOSE 8008
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8008"]
