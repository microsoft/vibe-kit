"""
Local validation script — run BEFORE pushing to ACR.

Tests everything that can be tested without a GPU:
1. All pip dependencies importable
2. Tokenizer loads for all 4 models (downloads if needed)
3. Flask app starts, /health returns 200
4. /score returns 400 with no GPU (expected — validates request parsing)

Usage:
    pip install transformers sentencepiece tiktoken protobuf huggingface_hub flask gunicorn
    python test_local.py
"""

import sys
import os

# Set HF cache to a local dir so we don't pollute global cache
os.environ.setdefault("HF_HOME", os.path.join(os.path.dirname(__file__), ".hf_cache"))

print("=" * 60)
print("Step 1: Verify imports")
print("=" * 60)

errors = []

for mod in ["transformers", "sentencepiece", "tiktoken", "protobuf", "flask", "gunicorn", "huggingface_hub"]:
    try:
        if mod == "protobuf":
            __import__("google.protobuf")
        else:
            __import__(mod)
        print(f"  [OK] {mod}")
    except ImportError as e:
        print(f"  [FAIL] {mod}: {e}")
        errors.append(mod)

# torch is optional locally (huge package, only needed on GPU)
try:
    import torch
    print(f"  [OK] torch ({torch.__version__})")
except ImportError:
    print("  [SKIP] torch (not installed locally — OK, container has it)")

if errors:
    print(f"\nMissing: {errors}")
    print("Install with: pip install " + " ".join(errors))
    sys.exit(1)

print("\nAll imports OK.\n")

print("=" * 60)
print("Step 2: Verify tokenizer loads for all 4 models")
print("=" * 60)

from transformers import AutoTokenizer

MODELS = [
    "microsoft/Dayhoff-3b-GR-HM-c",
    "microsoft/Dayhoff-3b-GR-HM",
    "microsoft/Dayhoff-3b-UR90",
    "microsoft/Dayhoff-170m-UR50-BRn",
]

for m in MODELS:
    try:
        tok = AutoTokenizer.from_pretrained(m, trust_remote_code=True)
        print(f"  [OK] {m} -> {type(tok).__name__}, vocab_size={tok.vocab_size}")
    except Exception as e:
        print(f"  [FAIL] {m}: {e}")
        errors.append(m)

if errors:
    print(f"\nTokenizer failures: {errors}")
    sys.exit(1)

print("\nAll tokenizers OK.\n")

print("=" * 60)
print("Step 3: Verify Flask app starts and /health returns 200")
print("=" * 60)

# Patch: skip model loading (no GPU), just test Flask routing
sys.path.insert(0, os.path.dirname(__file__))

# Import the app without triggering init_models
import score_server
score_server.ready = True  # Fake ready state
score_server.generator = type("FakeGen", (), {"models": {"fake": True}})()

client = score_server.app.test_client()

resp = client.get("/health")
print(f"  /health -> {resp.status_code} {resp.get_json()}")
assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"

resp = client.get("/ready")
print(f"  /ready  -> {resp.status_code} {resp.get_json()}")
assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"

# Test /score with a request (will fail on model lookup, but validates parsing)
resp = client.post("/score", json={
    "prompt": "M",
    "model": "nonexistent",
    "num_sequences": 2,
    "max_length": 50,
})
print(f"  /score (bad model) -> {resp.status_code}")
assert resp.status_code == 400, f"Expected 400 for bad model, got {resp.status_code}"

print("\nFlask routing OK.\n")

print("=" * 60)
print("ALL CHECKS PASSED — safe to build with ACR")
print("=" * 60)
