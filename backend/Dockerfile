FROM python:3.10-slim

WORKDIR /app

# install system requirements
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy Requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY . .

CMD alembic upgrade head && uvicorn backend.main:app --host 0.0.0.0 --port 8000