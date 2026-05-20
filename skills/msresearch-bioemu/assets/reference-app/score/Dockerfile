# BioEMU 1.3.1 scoring container
#
# Layers ordered for cache efficiency:
#   1. System packages           (rarely changes)
#   2. Python dependencies       (changes when bioemu version bumps)
#   3. Model weights download    (changes when checkpoint changes)
#   4. Application code          (changes often — tiny layer)
#
# BioEMU requires torch>=2.6.0 (its pyproject.toml pins this).
# gunicorn --workers 1 because CUDA contexts cannot fork.
# --timeout 900 allows long diffusion sampling to finish.

FROM pytorch/pytorch:2.6.0-cuda12.4-cudnn9-runtime

ENV PORT=5001 \
    HF_HOME=/app/models \
    COLABFOLD_CACHE=/app/colabfold_cache \
    BIOEMU_MODEL_NAME=bioemu-v1.1 \
    BIOEMU_BATCH_SIZE_100=10 \
    BIOEMU_FILTER_SAMPLES=true \
    PYTHONUNBUFFERED=1

WORKDIR /app

# 1. System deps
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc g++ curl && \
    rm -rf /var/lib/apt/lists/*

# 2. Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 3. Pre-download model weights
COPY download_models.py .
RUN python download_models.py

# 4. Application code (small, changes often — last layer)
COPY score_server.py .

EXPOSE ${PORT}

CMD ["gunicorn", "score_server:app", \
     "--bind", "0.0.0.0:5001", \
     "--workers", "1", \
     "--timeout", "900", \
     "--graceful-timeout", "900"]
