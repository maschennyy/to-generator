#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/to-generator}"

cd "$APP_DIR"

docker compose exec -T ml-service sh -c 'curl -fsS -X POST -H "X-ML-Service-Token: ${ML_SERVICE_TOKEN}" http://127.0.0.1:8000/train'
