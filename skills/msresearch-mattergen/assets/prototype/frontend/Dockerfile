# MatterGen Frontend - Container Deployment
# Multi-stage build: Node.js build + Nginx serve

# =============================================================================
# Stage 1: Build the React/Vite application
# =============================================================================
FROM node:20-alpine AS builder

# Enable external mode for deployed builds (shows "Back to AI for Science Labs" link)
ENV VITE_EXTERNAL=true

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the production bundle (VITE_EXTERNAL is baked in at build time)
RUN npm run build

# =============================================================================
# Stage 2: Serve with Nginx
# =============================================================================
FROM nginx:alpine

# Install envsubst for runtime environment variable substitution
RUN apk add --no-cache gettext

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy nginx configuration template
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80 for HTTP traffic
EXPOSE 80

# Use envsubst to substitute environment variables at runtime, then start nginx
# BACKEND_URL should be the full backend URL (e.g., https://api.example.com)
# Falls back to http://${BACKEND_SERVICE}:5000 for local Docker Compose
CMD ["/bin/sh", "-c", "export BACKEND_URL=${BACKEND_URL:-http://${BACKEND_SERVICE}:5000} && envsubst '${BACKEND_URL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
