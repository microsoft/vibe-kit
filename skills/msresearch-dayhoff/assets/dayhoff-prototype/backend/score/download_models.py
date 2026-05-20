"""Pre-download all 4 Dayhoff models from HuggingFace at Docker build time.

Downloads model files and verifies tokenizer instantiation works.
Catches missing dependencies (sentencepiece, tiktoken) at build time.
"""

import os
import time

from huggingface_hub import snapshot_download
from transformers import AutoTokenizer

# Reliability tweaks: parallel file downloads + per-request timeout +
# resume-on-failure. Prior builds silently hung mid-download for one of the
# 3B variants with no retry.
os.environ.setdefault("HF_HUB_DOWNLOAD_TIMEOUT", "60")
os.environ.setdefault("HF_HUB_ENABLE_HF_TRANSFER", "1")

MODELS = [
    "microsoft/Dayhoff-3b-GR-HM-c",
    "microsoft/Dayhoff-3b-GR-HM",
    "microsoft/Dayhoff-3b-UR90",
    "microsoft/Dayhoff-170m-UR50-BRn",
]

MAX_ATTEMPTS = 4

for m in MODELS:
    print(f"Downloading {m}...", flush=True)
    last_err = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            path = snapshot_download(m, max_workers=8, etag_timeout=30)
            print(f"  Downloaded to: {path}", flush=True)
            break
        except Exception as e:  # network hiccup, partial file, etc.
            last_err = e
            print(f"  attempt {attempt}/{MAX_ATTEMPTS} failed: {e}", flush=True)
            if attempt == MAX_ATTEMPTS:
                raise
            time.sleep(min(30, 5 * attempt))
    # Verify tokenizer loads — fail the build if deps are missing
    tok = AutoTokenizer.from_pretrained(m, trust_remote_code=True)
    print(f"  Tokenizer OK: {type(tok).__name__}", flush=True)

print("All models cached and verified.", flush=True)
