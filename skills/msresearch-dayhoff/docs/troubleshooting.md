# Dayhoff Troubleshooting

Common issues and fixes for the Dayhoff reference app and direct model use. If your issue isn't listed, check upstream [github.com/microsoft/dayhoff/issues](https://github.com/microsoft/dayhoff/issues).

## Critical Errors

| Error | Cause | Fix |
|---|---|---|
| `nvidia-smi: command not found` (WSL2) | NVIDIA driver installed inside WSL distro instead of on Windows host | Uninstall the in-WSL driver, install the NVIDIA driver on the **Windows host** per [NVIDIA's CUDA-on-WSL guide](https://docs.nvidia.com/cuda/wsl-user-guide/index.html). `nvidia-smi` should then work in both PowerShell and WSL2. |
| `ValueError: Fast Mamba kernels are not available` | `mamba-ssm` / `causal-conv1d` not installed | Pass `use_mamba_kernels=False` when loading the model. For best performance, install the kernels from source per the upstream Dayhoff README. |
| `HTTP 401 Unauthorized` from proxy → AML | Invalid `DAYHOFF_API_KEY`, expired token, or missing role assignment | Regenerate the AML endpoint key, update `.env`, restart the proxy. Confirm the calling identity has the correct role on the AML workspace. |
| `HTTP 400` with `"model X does not support homologs"` | Sent `homologs` payload to `3b-UR90` or `170m-UR50-BRn` | Switch to `3b-GR-HM-c` or `3b-GR-HM`, or remove the `homologs` field. Only those two variants were trained on MSA data. |
| `HuggingFaceHubHTTPError: 429 Too Many Requests` | HF rate limiting during weight download | Run `huggingface-cli login`; set `HUGGINGFACE_HUB_ENABLE_HF_TRANSFER=1`; retry with backoff. |
| `OSError: [Errno 28] No space left on device` during weight download | Loading all four 3B variants needs ~25 GB | Free disk, or set `DAYHOFF_LOAD_ALL=0` in the score server env to load only the 170M variant. |
| `CUDA out of memory` when loading `score/` | Trying to load all four variants on a GPU < 24 GB | Set `DAYHOFF_LOAD_ALL=0` for 170M-only mode (~1 GB), or upgrade to a single A100 80 GB for all four. |
| Frontend shows "Failed to fetch" / network error | Proxy backend not running or wrong port | Check Terminal 2: `python app.py` should be listening on `:8000`. The Vite dev server proxies `/api/*` to `:8000` per `frontend/vite.config.ts`. If you intentionally have no backend running, you're on Path A (cached demo) — see the row below. |
| Frontend loads, badge says "Backend offline · cached examples only" | You're on Path A (cached demo, no backend) | Expected. Click any of the four example chips (Cas9, insulin, DNA polymerase, SARS-CoV-2 spike) for an instant cached real Dayhoff result. To run custom prompts or new model/prompt combos, start the proxy backend (Path B) or the local score server (Path C) per [`quick-start.md`](quick-start.md). |
| Score server returns 503 / `model not ready` | Server is still loading weights | Poll `curl http://localhost:5001/ready`. First start can take many minutes for the 3B variants. Don't interrupt. |
| ESMFold returns 413 / "sequence too long" | Public ESM Atlas API caps at 400 aa | Deploy the bundled `backend/fold/` server to AML and point `ESMFOLD_ENDPOINT` at it. With chunked attention it handles up to ~1200 aa. |

## Multi-Terminal Setup Mistakes

| Symptom | Cause | Fix |
|---|---|---|
| Backend exits when you run another command | You ran the next step in the same terminal | Each long-running server needs its own terminal. Score on `:5001`, proxy on `:8000`, frontend on `:5173`, optional fold on its own port. |
| Port `:8000` already in use | Previous proxy didn't shut down cleanly, or a different app is bound | `lsof -ti:8000 \| xargs kill` then restart. Same pattern for `:5001` and `:5173`. |
| `.env` not picked up | Wrong working directory or wrong filename | The proxy looks for `.env` relative to `backend/app.py`'s working dir. Run `python app.py` from `backend/`, not from the repo root. |

## Quick Diagnostics

```bash
# 1. Verify GPU and CUDA
nvidia-smi
python - <<'PY'
import torch
print("CUDA available:", torch.cuda.is_available())
print("CUDA version:", torch.version.cuda)
print("Device count:", torch.cuda.device_count())
PY

# 2. Confirm Dayhoff weights cached
ls -lh ~/.cache/huggingface/hub/models--microsoft--Dayhoff-170m-GR

# 3. Confirm score server is reachable
curl -i http://localhost:5001/ready

# 4. Confirm proxy is reachable
curl -i http://localhost:8000/api/health

# 5. End-to-end smoke test against the proxy
curl -s -X POST http://localhost:8000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "M", "model": "170m-UR50-BRn", "num_sequences": 2, "max_length": 40}' | jq .
```

## Common Fixes

- **Dependencies out of sync:** `pip install --upgrade -r backend/requirements.txt` (full) or `pip install --upgrade -r backend/requirements-proxy.txt` (proxy-only).
- **Tokenizer warnings:** Set `TOKENIZERS_PARALLELISM=false` to silence Hugging Face tokenizer contention warnings during batch runs.
- **Azure Storage permissions** (if exporting to Blob from a custom endpoint): grant `Storage Blob Data Contributor` to the proxy's managed identity.
- **Stale frontend after backend changes:** Vite hot-reloads the frontend, but if you changed proxy routes, also restart the backend and refresh the browser.
- **Cache poisoning across model variants:** The frontend's `demoCache.ts` keys on `(prompt, model, max_length, num_sequences)`. If results look wrong after a backend change, clear sessionStorage or hard-refresh.

## Performance-Related Issues

For slow generation, OOM during sampling, or thermal throttling, see [`performance-guide.md`](performance-guide.md).

## Biosecurity-Related Errors

If the toxin screening (`backend/sequence_screening.py`) flags an input or output, the proxy returns a structured error rather than the sequence. Do not try to bypass the screen. Review [`responsible-use.md`](responsible-use.md) and reconsider the request.
