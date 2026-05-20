# Troubleshooting

Common failure modes when running BioEmu locally.

## GPU not visible

```bash
nvidia-smi                                # should list your GPU
python -c "import torch; print(torch.cuda.is_available())"   # should print True
```

If `nvidia-smi` fails, install or update your NVIDIA drivers. If `torch.cuda.is_available()` is `False` despite `nvidia-smi` working, your `torch` install is CPU-only — reinstall with `pip install bioemu[cuda]`.

> **Common mistake:** `pip install bioemu` (without `[cuda]`) pulls CPU-only torch and incompatible tensorflow/jax versions, causing multiple cascading errors (protobuf descriptor crash, jax CPU fallback, nvcc import TypeError). Always use `pip install bioemu[cuda]`.

CPU-only is not a supported workflow beyond ~10-residue toy sequences.

## Windows: `nvidia-smi` works in PowerShell but not in WSL2

You installed NVIDIA drivers in the wrong place. The driver must be installed on the **Windows host**, not inside the WSL2 distro. Do **not** `apt install nvidia-driver-*` inside WSL — it will break GPU passthrough. Uninstall any in-distro NVIDIA packages, then follow [NVIDIA's CUDA-on-WSL guide](https://docs.nvidia.com/cuda/wsl-user-guide/index.html) to install the host driver. Verify by running `nvidia-smi` inside the WSL distro after restarting it (`wsl --shutdown` from PowerShell, then reopen).

## Windows: Docker `--gpus all` fails inside WSL2

Use **Docker Desktop for Windows** with the WSL2 backend enabled, not `apt install docker.io` inside the WSL distro. Docker Desktop wires up GPU passthrough automatically; the standalone Linux Docker package inside WSL does not. See [Microsoft's WSL install guide](https://learn.microsoft.com/windows/wsl/install) and Docker Desktop's WSL2 integration settings.

## Weight download stalls or fails

The first run downloads ~3.5 GB to `~/.cache/colabfold/` (CLI / bare-metal `score/`) or `/app/colabfold_cache` (Docker `score/`). Symptoms include long silent waits or partial downloads.

- Check disk space (`df -h ~/.cache`).
- Re-run the same command; partial downloads resume.
- If hitting Hugging Face rate limits, set `HF_TOKEN` to an authenticated token.

## ColabFold MMseqs2 timeout / MSA failure

BioEmu calls an external MMseqs2 server for MSA generation on first use of a new sequence. If it times out:

- Try again — the public MMseqs2 server has variable load.
- Pre-compute your MSA and pass an A3M file path as the `--sequence` argument instead.
- Override the server via the `--msa_host_url` flag (see upstream `sample.py`).

## Path B: `score/` won't start

### Docker: `could not select device driver "" with capabilities: [[gpu]]`

You're missing `nvidia-container-toolkit`. Install it from NVIDIA's docs and restart Docker.

### Port 5001 already in use

```bash
lsof -i :5001       # find what's using it
docker run ... -p 5002:5001 bioemu-score:local   # remap host port
```

If you remap, update `AZURE_BIOEMU_ENDPOINT` in `.env` accordingly.

### Bare-metal: `bioemu` import fails

Use a fresh Python 3.10+ venv. Don't mix `bioemu` with conflicting torch versions.

## Path B: proxy can't reach `score/`

Check readiness directly:

```bash
curl http://localhost:5001/ready          # 200 once model is loaded
curl -X POST http://localhost:5001/score \
    -H "Content-Type: application/json" \
    -d '{"input_data": {"sequence": "NLYIQWLKDGGPSSGRPPPS", "num_samples": 2}}'
```

If `/ready` returns non-200, the model is still loading — wait. If `/score` errors but `/ready` is 200, check the `score/` server logs.

## Path B: `/api/status` reports `connected` but predictions fail

The prototype's `/api/status` endpoint is currently a stub that always returns `connected`. Don't trust it for connectivity diagnosis. Verify by actually running a prediction (Trp-cage, 5 samples) and checking all three terminal logs.

## Path B: `npm install` fails

```bash
npm install --legacy-peer-deps
```

## MDTraj / DSSP errors

```bash
# Ubuntu/Debian
sudo apt-get install dssp

# macOS
brew install brewsci/bio/dssp
```

## Side-chain reconstruction fails

`bioemu.sidechain_relax` requires `conda` on `PATH` and CUDA12-compatible drivers. If automatic HPacker install fails, install manually per [HPacker's repo](https://github.com/gvisani/hpacker) and set `HPACKER_PYTHONBIN` to its python executable.

## Blackwell GPUs (RTX 5090/5080, sm_120): Docker `score/` crashes with "no kernel image is available"

The bundled `score/` Dockerfile uses `pytorch/pytorch:2.6.0-cuda12.4-cudnn9-runtime`, which only ships kernels up to sm_90 (Hopper). Blackwell GPUs (compute capability 12.0 / sm_120) need PyTorch 2.7+ built with CUDA 12.8+.

**Path A is unaffected** — `pip install bioemu[cuda]` pulls a compatible torch version automatically.

**Path B workaround — use the bare-metal fallback** instead of Docker:

```bash
cd score
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
pip install torch --index-url https://download.pytorch.org/whl/cu128   # override with Blackwell-compatible wheel
python score_server.py
```

Alternatively, rebuild the Docker image with a newer PyTorch base once one is available with sm_120 support (e.g. `pytorch/pytorch:2.7.0-cuda12.8-cudnn9-runtime` or later).
