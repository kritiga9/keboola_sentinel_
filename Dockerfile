# NOTE: Keboola Data Apps do NOT use this Dockerfile.
# Keboola uses keboola-config/setup.sh + supervisord + nginx instead.
# This Dockerfile is only for local Docker testing.

FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build   # outputs to /app/static via outDir: '../static'

FROM python:3.11-slim
WORKDIR /app
RUN pip install uv
COPY pyproject.toml .
RUN uv sync
COPY app/ ./app/
COPY --from=frontend /app/static ./static

EXPOSE 5000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5000"]
