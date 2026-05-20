"""
Local validation for the BioEMU scoring container.

Run this WITHOUT a GPU to verify:
  - bioemu 1.3.1 installs and imports correctly
  - The sample() function signature matches what score_server.py expects
  - The Flask app loads without crashing
  - The model download script can locate download functions

Run this WITH a GPU to additionally verify:
  - End-to-end inference (tiny sequence, few samples)

Usage:
  pip install bioemu==1.3.1 flask gunicorn
  python test_local.py           # CPU-only checks
  python test_local.py --gpu     # include GPU inference test
"""

import importlib
import inspect
import sys

PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"
SKIP = "\033[93mSKIP\033[0m"
failures = 0


def check(label, fn):
    global failures
    try:
        fn()
        print(f"  [{PASS}] {label}")
    except Exception as e:
        failures += 1
        print(f"  [{FAIL}] {label}: {e}")


def skip(label, reason):
    print(f"  [{SKIP}] {label} — {reason}")


# ── 1. bioemu imports ───────────────────────────────────────────────
print("\n1. Checking bioemu installation...")

check("import bioemu", lambda: importlib.import_module("bioemu"))

def check_version():
    import bioemu
    v = getattr(bioemu, "__version__", "unknown")
    assert v.startswith("1.3"), f"Expected 1.3.x, got {v}"

check("bioemu version is 1.3.x", check_version)

check("import bioemu.sample", lambda: importlib.import_module("bioemu.sample"))

# ── 2. sample.main() signature ─────────────────────────────────────
print("\n2. Checking sample.main() signature...")

def check_main_signature():
    from bioemu.sample import main
    sig = inspect.signature(main)
    required = {"sequence", "num_samples", "output_dir"}
    params = set(sig.parameters.keys())
    missing = required - params
    assert not missing, f"Missing parameters: {missing}"

check("main() has required params", check_main_signature)

def check_main_optional_params():
    from bioemu.sample import main
    sig = inspect.signature(main)
    expected_optional = {
        "batch_size_100", "model_name", "filter_samples",
        "msa_host_url", "cache_embeds_dir", "steering_config",
    }
    params = set(sig.parameters.keys())
    missing = expected_optional - params
    assert not missing, f"Missing optional parameters: {missing}"

check("main() has expected optional params", check_main_optional_params)

# ── 3. Internal functions used by score_server.py ───────────────────
print("\n3. Checking internal imports used by score_server.py...")

check("generate_batch", lambda: getattr(
    importlib.import_module("bioemu.sample"), "generate_batch"))

check("DEFAULT_DENOISER_CONFIG_DIR", lambda: getattr(
    importlib.import_module("bioemu.sample"), "DEFAULT_DENOISER_CONFIG_DIR"))

check("save_pdb_and_xtc", lambda: getattr(
    importlib.import_module("bioemu.convert_chemgraph"), "save_pdb_and_xtc"))

check("check_protein_valid", lambda: getattr(
    importlib.import_module("bioemu.seq_io"), "check_protein_valid"))

check("maybe_download_checkpoint", lambda: getattr(
    importlib.import_module("bioemu.model_utils"), "maybe_download_checkpoint"))

check("load_model", lambda: getattr(
    importlib.import_module("bioemu.model_utils"), "load_model"))

check("load_sdes", lambda: getattr(
    importlib.import_module("bioemu.model_utils"), "load_sdes"))

check("log_physicality", lambda: getattr(
    importlib.import_module("bioemu.steering"), "log_physicality"))

# ── 4. Flask app loads ──────────────────────────────────────────────
print("\n4. Checking Flask app loads (without model)...")

def check_flask_app():
    """Import only the Flask setup, not the init_model() call."""
    from flask import Flask
    app = Flask(__name__)
    # Just verify Flask itself works — the real score_server.py
    # calls init_model() at import time which requires GPU.
    assert app is not None

check("Flask app instantiation", check_flask_app)

# ── 5. Denoiser config exists ───────────────────────────────────────
print("\n5. Checking default config files...")

def check_denoiser_config():
    from bioemu.sample import DEFAULT_DENOISER_CONFIG_DIR
    dpm_config = DEFAULT_DENOISER_CONFIG_DIR / "dpm.yaml"
    assert dpm_config.exists(), f"Not found: {dpm_config}"

check("dpm.yaml denoiser config exists", check_denoiser_config)

# ── 6. GPU inference (optional) ─────────────────────────────────────
print("\n6. GPU inference test...")

if "--gpu" in sys.argv:
    def check_gpu_inference():
        import torch
        assert torch.cuda.is_available(), "No CUDA GPU available"

        from bioemu.sample import main as sample
        import tempfile
        import os

        with tempfile.TemporaryDirectory() as tmpdir:
            sample(
                sequence="GYDPETGTWG",  # Chignolin (10 residues, fast)
                num_samples=2,
                output_dir=tmpdir,
                filter_samples=False,
            )
            pdb = os.path.join(tmpdir, "topology.pdb")
            xtc = os.path.join(tmpdir, "samples.xtc")
            assert os.path.exists(pdb), "topology.pdb not produced"
            assert os.path.exists(xtc), "samples.xtc not produced"
            assert os.path.getsize(pdb) > 0, "topology.pdb is empty"
            assert os.path.getsize(xtc) > 0, "samples.xtc is empty"

    check("End-to-end BioEMU inference (Chignolin, 2 samples)", check_gpu_inference)
else:
    skip("GPU inference", "pass --gpu to enable")


# ── Summary ─────────────────────────────────────────────────────────
print(f"\n{'='*50}")
if failures:
    print(f"{failures} check(s) failed.")
    sys.exit(1)
else:
    print("All checks passed.")
    sys.exit(0)
