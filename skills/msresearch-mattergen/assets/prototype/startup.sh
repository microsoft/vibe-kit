#!/bin/bash
set -e
mkdir -p /var/log/nginx /var/lib/nginx /run/nginx /app/backend/data
chmod 755 /var/log/nginx /var/lib/nginx /run/nginx
echo "Starting uvicorn backend..."
cd /app/backend
python3 -m uvicorn main:app --host 127.0.0.1 --port 5000 --workers 1 &
UVICORN_PID=$!
sleep 2
echo "Starting nginx..."
nginx -g "daemon off;" &
NGINX_PID=$!
cleanup() {
  kill -TERM "$UVICORN_PID" 2>/dev/null || true
  kill -TERM "$NGINX_PID" 2>/dev/null || true
  wait
}
trap 'cleanup; exit 130' SIGTERM SIGINT
wait -n $UVICORN_PID $NGINX_PID
EXIT_STATUS=$?
cleanup
exit $EXIT_STATUS
