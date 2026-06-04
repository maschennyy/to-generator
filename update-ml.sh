#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"

cd "$APP_DIR"

echo "[1/5] Pull kode terbaru dari git..."
git pull --ff-only

echo "[2/5] Build ulang image ML service..."
docker compose build ml-service

echo "[3/5] Restart ML service..."
docker compose up -d ml-service

echo "[4/5] Menunggu ML service sehat..."
for i in {1..30}; do
  if docker compose exec -T ml-service curl -fsS http://127.0.0.1:8000/health >/dev/null; then
    echo "ML service sudah sehat."
    break
  fi

  if [ "$i" -eq 30 ]; then
    echo "ML service belum sehat setelah 30 percobaan."
    docker compose logs --tail=80 ml-service
    exit 1
  fi

  sleep 3
done

echo "[5/5] Trigger training ulang model..."
docker compose exec -T ml-service sh -c 'curl -fsS -X POST -H "X-ML-Service-Token: ${ML_SERVICE_TOKEN}" http://127.0.0.1:8000/train'

echo
echo "Selesai. Training berjalan di background; cek status dengan:"
echo "docker compose logs -f ml-service"
