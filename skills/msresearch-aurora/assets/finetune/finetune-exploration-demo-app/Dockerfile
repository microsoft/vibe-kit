# Aurora Finetune Combined Container — FE + BE in one image
# nginx serves frontend static files + proxies /api to local uvicorn
#
# Build context: skills/msresearch-aurora/
#
# Slim build (cache-only serving, no model inference):
#   docker build --build-arg INSTALL_MODEL_DEPS=false \
#     -f assets/finetune/finetune-exploration-demo-app/Dockerfile \
#     -t aurora-finetune:latest .
#
# Full build (with model inference capability):
#   docker build --build-arg INSTALL_MODEL_DEPS=true \
#     -f assets/finetune/finetune-exploration-demo-app/Dockerfile \
#     -t aurora-finetune:full .

# Stage 1: Build frontend
FROM node:20-bookworm-slim AS frontend
WORKDIR /app
# The generated Aurora forecast payload is large enough to exceed Node's
# default heap during `tsc && vite build` in CI/container builds.
ENV NODE_OPTIONS=--max-old-space-size=8192
COPY assets/finetune/finetune-exploration-demo-app/frontend/package.json \
     assets/finetune/finetune-exploration-demo-app/frontend/package-lock.json ./
RUN npm ci
COPY assets/finetune/finetune-exploration-demo-app/frontend/ ./
ARG VITE_AI4S_HOME_URL=https://www.microsoft.com/en-us/research/lab/microsoft-research-ai-for-science/
ENV VITE_AI4S_HOME_URL=$VITE_AI4S_HOME_URL
RUN npm run build

# Stage 2: Combined runtime
FROM python:3.11-slim

# Whether to install model dependencies (vibe-tune-aurora, PyTorch+CUDA)
ARG INSTALL_MODEL_DEPS=false

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update -o Acquire::Retries=5 \
    && apt-get install -y --no-install-recommends \
        nginx \
        gcc \
        g++ \
        libeccodes-dev \
        dos2unix \
    && rm -rf /var/lib/apt/lists/*

# Create non-root nginx dirs
RUN mkdir -p /var/log/nginx /var/lib/nginx /run/nginx /usr/share/nginx/html \
    && chmod 755 /var/log/nginx /var/lib/nginx /run/nginx

WORKDIR /app

# Install backend (vibe-tune-aurora is an optional dep, so this works in slim mode)
COPY assets/finetune/finetune-exploration-demo-app/backend /app/backend
RUN pip install --no-cache-dir --retries 5 --timeout 100 -e /app/backend

# Conditionally install starter-code (vibe-tune-aurora) for full builds.
# We always COPY to a staging dir (Docker COPY can't be conditional), then move or remove.
COPY starter-code /tmp/starter-code-staging
RUN if [ "$INSTALL_MODEL_DEPS" = "true" ]; then \
        mv /tmp/starter-code-staging /app/starter-code && \
        pip install --no-cache-dir -e /app/starter-code && \
        touch /app/.model_deps_installed; \
    else \
        rm -rf /tmp/starter-code-staging; \
    fi

# Copy data files
COPY assets/finetune/finetune-exploration-demo-app/assets/outputs /app/assets/outputs

# Copy built frontend + nginx config + startup script
COPY --from=frontend /app/dist /usr/share/nginx/html
COPY assets/finetune/finetune-exploration-demo-app/nginx.conf /etc/nginx/nginx.conf
COPY assets/finetune/finetune-exploration-demo-app/startup.sh /startup.sh
RUN chmod +x /startup.sh && dos2unix /startup.sh 2>/dev/null; sed -i 's/\r$//' /startup.sh

ENV PYTHONUNBUFFERED=1
EXPOSE 80
CMD ["/startup.sh"]
