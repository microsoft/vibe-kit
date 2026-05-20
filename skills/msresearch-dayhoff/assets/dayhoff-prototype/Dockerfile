# Dayhoff Prototype — App Service container
# Serves React frontend + Flask proxy to Azure ML endpoint
# No GPU, no models — lightweight proxy (~500 MB image)

# ── Stage 1: Build frontend ─────────────────────────────────
FROM mcr.microsoft.com/azurelinux/base/nodejs:20 AS frontend-build

# Sub-path the SPA + static assets will be served under.
# Default '/' for local dev / root-path deployment.
# A sub-path deployment passes the desired prefix via --build-arg.
ARG BASE_URL=/
ENV BASE_URL=$BASE_URL

WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN chmod +x node_modules/.bin/* && npm run build

# ── Stage 2: Production image ───────────────────────────────
# python:3.11.12-slim-bookworm — pinned to a specific patch so base-image
# updates don't surprise us. Previous cbl-mariner shipped 3.9 (no PEP 604).
FROM python:3.11.12-slim-bookworm

LABEL org.opencontainers.image.title="Dayhoff Prototype" \
      org.opencontainers.image.vendor="Microsoft Research"

# Re-declare so it's available at runtime stage too (Flask reads it).
ARG BASE_URL=/
ENV BASE_URL=$BASE_URL \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

# Install Python dependencies (lightweight — no torch, no transformers)
COPY backend/requirements-proxy.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source (proxy mode — no generator.py, no model code)
COPY backend/app.py backend/constants.py backend/exporters.py backend/sequence_screening.py ./

# Copy pre-built frontend assets
COPY --from=frontend-build /build/dist ./static

EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT}/api/health')"

CMD ["sh", "-c", "gunicorn app:app --bind 0.0.0.0:${PORT} --workers 2 --timeout 600"]
