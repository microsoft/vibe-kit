# Backend Dockerfile for Aurora Finetuning Demo API
#
# Build context: aurora-finetune directory (contains both starter-code and assets/)
#
# Slim build (~4-5GB) - cache-only serving, no model inference:
#   docker build --build-arg INSTALL_MODEL_DEPS=false \
#     -f assets/finetune/finetune-exploration-demo-app/backend/Dockerfile \
#     -t aurora-finetune-backend:slim .
#
# Full build (~13GB) - with model inference capability:
#   docker build --build-arg INSTALL_MODEL_DEPS=true \
#     -f assets/finetune/finetune-exploration-demo-app/backend/Dockerfile \
#     -t aurora-finetune-backend:full .

FROM python:3.11-slim

# Whether to install model dependencies (vibe-tune-aurora, PyTorch+CUDA)
ARG INSTALL_MODEL_DEPS=false

# Set working directory
WORKDIR /app

# Install system dependencies (including for pygrib)
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libeccodes-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy the demo app
COPY assets/finetune/finetune-exploration-demo-app/backend /app/backend
COPY assets/finetune/finetune-exploration-demo-app/assets/outputs /app/assets/outputs

# Conditionally copy and install starter-code (vibe-tune-aurora) for full builds.
# We always COPY to a staging dir (Docker COPY can't be conditional), then move or remove.
COPY starter-code /tmp/starter-code-staging
RUN if [ "$INSTALL_MODEL_DEPS" = "true" ]; then \
        mv /tmp/starter-code-staging /app/starter-code && \
        pip install --no-cache-dir -e /app/starter-code; \
    else \
        rm -rf /tmp/starter-code-staging; \
    fi

# Install backend dependencies (vibe-tune-aurora is now an optional dep, so this works in slim mode)
RUN pip install --no-cache-dir -e /app/backend

# Expose port
EXPOSE 8000

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Write a sentinel file for full builds so CMD can set PYTHONPATH accordingly
RUN if [ "$INSTALL_MODEL_DEPS" = "true" ]; then \
        touch /app/.model_deps_installed; \
    fi

# Run the application from the app directory (so relative paths to assets work)
WORKDIR /app
CMD ["sh", "-c", "if [ -f /app/.model_deps_installed ]; then export PYTHONPATH=/app/backend/src:/app/starter-code/src; else export PYTHONPATH=/app/backend/src; fi && python -m uvicorn aft_demo_backend.api:app --host 0.0.0.0 --port 8000"]
