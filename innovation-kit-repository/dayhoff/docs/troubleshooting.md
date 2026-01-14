# Dayhoff Atlas Troubleshooting

Common issues and solutions for Dayhoff setup and usage.

## Critical Issues

| Error | Cause | Fix |
|-------|-------|-----|
| `ValueError: Fast Mamba kernels are not available` | Missing mamba-ssm/causal-conv1d | Set `use_mamba_kernels=False` or install from source |
| `HTTP 401 Unauthorized` | Invalid Azure token | Regenerate `DAYHOFF_KEY`, confirm role assignment in Azure AI Foundry |
| `HuggingFaceHubHTTPError: 429` | Rate limited | Run `huggingface-cli login`, set `HUGGINGFACE_HUB_ENABLE_HF_TRANSFER=1` |

## Quick Diagnostics

```bash
# Verify CUDA toolkit versions
nvidia-smi
python - <<'PY'
import torch
print(torch.version.cuda, torch.cuda.is_available())
PY

# Confirm Dayhoff weights cached
ls -lh ~/.cache/huggingface/hub/models--microsoft--Dayhoff-170m-GR
```

## Common Fixes

**Dependencies**: `pip install --upgrade torch==2.2.0 transformers==4.39.3 datasets==2.19.0`  
**Configuration**: Set `TOKENIZERS_PARALLELISM=false` to silence tokenizer contention warnings during batch runs.  
**Permissions**: Add `Storage Blob Data Contributor` role to the service principal when exporting sequences to Azure Blob Storage.