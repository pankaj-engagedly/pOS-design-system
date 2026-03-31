FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py .
COPY server_sse.py .

EXPOSE 8020
CMD ["python", "server_sse.py"]
