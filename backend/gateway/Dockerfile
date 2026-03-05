FROM python:3.12-slim AS base

WORKDIR /app

# Install shared library first (for layer caching)
COPY ../shared /shared
RUN pip install --no-cache-dir /shared

# Install gateway dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ app/

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
