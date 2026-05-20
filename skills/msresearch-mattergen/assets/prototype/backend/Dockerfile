# MatterGen Backend - Container Deployment
# Python 3.12 FastAPI application

FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
# - build-essential: Required for some Python packages with C extensions
# - libgomp1: Required by pymatgen/numpy for OpenMP support
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash appuser

# Set working directory
WORKDIR /app

# Install pipenv
RUN pip install pipenv

# Copy dependency files first for better layer caching
COPY Pipfile Pipfile.lock ./

# Install dependencies from Pipfile.lock (production only, no dev packages)
# --deploy: Fail if Pipfile.lock is out of date
# --system: Install to system Python instead of virtualenv
RUN pipenv install --deploy --system

# Copy application code
COPY . .

# Change ownership to non-root user
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Create data directory for job storage (if not mounted as volume)
RUN mkdir -p /app/data

# Expose port 5000 (common convention for backend services)
EXPOSE 5000

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/api/health')" || exit 1

# Run uvicorn server
# - host 0.0.0.0: Listen on all interfaces
# - port 5000: Backend port
# - workers 1: Single worker (can scale via container replicas)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000", "--workers", "1"]
