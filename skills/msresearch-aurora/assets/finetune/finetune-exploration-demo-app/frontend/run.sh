#!/bin/sh
set -xeuo pipefail

cat nginx.conf.template

# Compute backend service name from frontend service name
# Frontend: *-frontend-{INSTANCE_ID} -> Backend: *-backend-{INSTANCE_ID}
SUFFIX="-frontend-${INSTANCE_ID}"
REPLACEMENT="-backend-${INSTANCE_ID}"
BACKEND_SERVICE="${SERVICE_NAME%${SUFFIX}}${REPLACEMENT}"

BACKEND_SERVICE=${BACKEND_SERVICE} DOLLAR='$' envsubst < nginx.conf.template > /etc/nginx/nginx.conf

cat /etc/nginx/nginx.conf

nginx -g 'daemon off;'
