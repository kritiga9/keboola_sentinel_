#!/bin/bash
set -Eeuo pipefail

echo "=== Installing Python dependencies ==="
cd /app
uv sync --no-dev

echo "=== Installing frontend dependencies ==="
cd /app/frontend
npm install

echo "=== Building frontend ==="
npm run build

echo "=== Setup complete ==="
