"""Pre-download ESMFold weights at Docker build time so the container starts cold-fast."""
import os
from huggingface_hub import snapshot_download

os.environ.setdefault("HF_HUB_ENABLE_HF_TRANSFER", "1")
os.environ.setdefault("HF_HOME", "/app/models")

MODEL_ID = "facebook/esmfold_v1"

print(f"Downloading {MODEL_ID} to {os.environ['HF_HOME']} ...", flush=True)
snapshot_download(repo_id=MODEL_ID, cache_dir=os.environ["HF_HOME"])
print("Done.", flush=True)
