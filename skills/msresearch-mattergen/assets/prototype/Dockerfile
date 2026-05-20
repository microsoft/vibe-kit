# MatterGen Combined Container — FE + BE in one image
# Matches Corp deployment pattern (mattergen-prototype:latest)
# nginx serves frontend static files + proxies /api to local uvicorn

# Stage 1: Build frontend
FROM node:20-alpine AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Combined runtime
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx build-essential libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root dirs
RUN mkdir -p /var/log/nginx /var/lib/nginx /run/nginx /usr/share/nginx/html /app/backend/data \
    && chmod 755 /var/log/nginx /var/lib/nginx /run/nginx

# Install Python deps
WORKDIR /app
RUN pip install pipenv
COPY backend/Pipfile backend/Pipfile.lock ./
RUN pipenv install --deploy --system

# Copy backend code
COPY backend/ /app/backend/

# Copy built frontend + nginx config + startup script
COPY --from=frontend /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
COPY startup.sh /startup.sh
RUN chmod +x /startup.sh && dos2unix /startup.sh 2>/dev/null; sed -i 's/\r$//' /startup.sh

EXPOSE 80
CMD ["/startup.sh"]
