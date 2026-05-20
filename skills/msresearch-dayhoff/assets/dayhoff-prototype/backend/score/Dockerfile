# Dayhoff Scoring - slim build with prebuilt mamba wheels (no nvcc).
FROM pytorch/pytorch:2.4.1-cuda12.4-cudnn9-runtime

LABEL org.opencontainers.image.title="Dayhoff Multi-Model Scoring" \
      org.opencontainers.image.vendor="Microsoft Research"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    DAYHOFF_LOAD_ALL=1 \
    HF_HOME=/app/models \
    PORT=5001

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Prebuilt Mamba + causal-conv1d wheels for CUDA 12.x / PyTorch 2.4 / cp311.
# If the base image changes PyTorch or CUDA major version, these must be
# rebuilt from source or fetched for the matching ABI.
#   causal_conv1d-1.4.0  sha256: (verify after first pull)
#   mamba_ssm-2.2.6.post3  sha256: (verify after first pull)
RUN pip install --no-cache-dir \
    https://github.com/Dao-AILab/causal-conv1d/releases/download/v1.4.0/causal_conv1d-1.4.0+cu122torch2.4cxx11abiFALSE-cp311-cp311-linux_x86_64.whl \
    https://github.com/state-spaces/mamba/releases/download/v2.2.6.post3/mamba_ssm-2.2.6.post3+cu12torch2.4cxx11abiFALSE-cp311-cp311-linux_x86_64.whl

COPY download_models.py ./
RUN python download_models.py

COPY score_server.py generator.py constants.py ./

EXPOSE ${PORT}

CMD ["gunicorn", "score_server:app", \
     "--bind", "0.0.0.0:5001", \
     "--workers", "1", \
     "--worker-class", "gthread", \
     "--threads", "4", \
     "--timeout", "600"]
