# ESMFold structure-prediction server for Dayhoff prototype.
# Self-hosted alternative to the public ESM Atlas API (which caps at 400 aa).
# This image accepts up to 1500 aa per request on an A100 80GB.
FROM pytorch/pytorch:2.4.1-cuda12.4-cudnn9-runtime

LABEL org.opencontainers.image.title="Dayhoff ESMFold Server" \
      org.opencontainers.image.vendor="Microsoft Research"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    HF_HOME=/app/models \
    HF_HUB_ENABLE_HF_TRANSFER=1 \
    PORT=5001

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download esmfold_v1 weights (~2.7 GB) at build time so the container
# starts cold without a long model fetch on the AML compute.
COPY download_model.py ./
RUN python download_model.py

COPY fold_server.py ./

EXPOSE ${PORT}

# Single worker, single thread: ESMFold is GPU-bound and one request saturates
# the device. AML serializes via max_concurrent_requests_per_instance=1.
# 600s timeout covers the worst-case 1500 aa fold (~5–6 min on A100).
CMD ["gunicorn", "fold_server:app", \
     "--bind", "0.0.0.0:5001", \
     "--workers", "1", \
     "--worker-class", "gthread", \
     "--threads", "1", \
     "--timeout", "600"]
