# syntax=docker/dockerfile:1

ARG VARIANT="3.12-bullseye"
FROM mcr.microsoft.com/devcontainers/python:${VARIANT}

# Proxy support (optional; populated via build args if present)
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
ENV http_proxy=${HTTP_PROXY} \
    https_proxy=${HTTPS_PROXY} \
    no_proxy=${NO_PROXY}

# Install Node.js LTS (using NodeSource)
USER root
SHELL ["/bin/bash", "-lc"]
RUN set -euxo pipefail \ 
    && arch=$(dpkg --print-architecture) \ 
    && apt-get update \ 
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg \ 
    && mkdir -p /etc/apt/keyrings \ 
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \ 
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" > /etc/apt/sources.list.d/nodesource.list \ 
    && apt-get update \ 
    && apt-get install -y --no-install-recommends nodejs \ 
    && apt-get clean \ 
    && rm -rf /var/lib/apt/lists/*

ENV UV_CACHE_DIR=/tmp/uv-cache \
    UV_LINK_MODE=copy \
    UV_PYTHON=/usr/local/bin/python3 \
    TMPDIR=/tmp

# Azure CLI provided by Dev Container Feature (see devcontainer.json)

# Use the vscode user for subsequent operations in container
USER vscode
SHELL ["/bin/bash", "-lc"]
# Install Astral's uv/uvx for the vscode user (goes to ~/.local/bin)
RUN set -euxo pipefail; \
    for i in 1 2 3; do \
        curl -fsSL https://astral.sh/uv/install.sh | sh && break || { echo "[Dockerfile] uv install attempt $i failed; retrying in 3s..."; sleep 3; }; \
    done
RUN node --version && npm --version && python3 --version

# Note: MCP servers are initialized in postCreateCommand.sh to keep the image lean
