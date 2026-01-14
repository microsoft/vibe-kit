# Dayhoff Quick Start

Generate your first protein sequences in under 10 minutes.

## Reference App (Recommended)

The fastest way to get started—a React web app with Flask backend:

```bash
# Terminal 1: Backend API
cd assets/dayhoff-prototype/backend
pip install -r requirements.txt
python app.py  # First run downloads model (~700MB)
```

```bash
# Terminal 2: Frontend UI
cd assets/dayhoff-prototype/frontend
npm install
npm run dev
```

Open **http://localhost:5173** and generate sequences!

---

## Alternative: Python Script

For programmatic access without the web app:

```python
from transformers import AutoTokenizer, AutoModelForCausalLM

tokenizer = AutoTokenizer.from_pretrained("microsoft/Dayhoff-170m-GR", trust_remote_code=True)
model = AutoModelForCausalLM.from_pretrained(
    "microsoft/Dayhoff-170m-GR",
    trust_remote_code=True,
    use_mamba_kernels=False,
)

inputs = tokenizer("M", return_tensors="pt")
outputs = model.generate(
    **inputs,
    max_length=60,
    num_return_sequences=3,
    temperature=0.8,
    do_sample=True,
)

sequences = [tokenizer.decode(seq, skip_special_tokens=True) for seq in outputs]
print(sequences)
```

## Alternative: Azure AI Foundry

For cloud-hosted inference (no local GPU needed):

```python
import os, requests

response = requests.post(
    os.environ["DAYHOFF_ENDPOINT"],
    headers={"Authorization": f"Bearer {os.environ['DAYHOFF_KEY']}"},
    json={"prompt": "M", "num_sequences": 3, "max_length": 60},
)
print(response.json())
```

See the [Azure Deployment Guide](../../../../../docs/deployment/DEPLOYING-AZURE-AI-FOUNDRY-MODELS.md) for setup.

---

## Next Steps

- [Review safety guidelines](alignment-constitution.md) before exporting sequences
- [Load Dayhoff Atlas datasets](data-integration.md) for training data
- [Advanced workflows](application-patterns.md) for mutation scoring, batch processing
- [Troubleshooting](troubleshooting.md) if you hit issues