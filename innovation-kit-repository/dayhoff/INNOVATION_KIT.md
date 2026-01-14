---
name: "Dayhoff Atlas Innovation Kit"
description: Dayhoff Atlas accelerates protein design by pairing trillion-token training data with hybrid Mamba-Transformer models for rapid sequence generation and mutation scoring.
version: 0.1.0
referenceLinks:
  - label: "Azure AI Foundry Model Catalog"
    url: "https://ai.azure.com/catalog/models/Dayhoff-170m-GR"
  - label: "GitHub"
    url: "https://github.com/microsoft/dayhoff"
  - label: "Research Paper"
    url: "https://aka.ms/dayhoff/preprint"
  - label: "Dayhoff Atlas Collection"
    url: "https://huggingface.co/collections/microsoft/dayhoff-atlas-6866d679465a2685b06ee969"
---
# Innovation Kit Contents

## Getting Started

1. **Quick Start**: Load `docs/quick-start.md` to run the hello world experience and confirm model access
2. **Reference App**: Try `assets/dayhoff-prototype/` — a React + Flask app for interactive sequence generation
3. **Safety Guidelines**: Review `docs/alignment-constitution.md` before exporting any sequences

## Reference App

The prototype features a React frontend with Flask backend:

```bash
# Terminal 1: Backend API (port 5001)
cd assets/dayhoff-prototype/backend
pip install -r requirements.txt
python app.py

# Terminal 2: Frontend UI (port 5173)
cd assets/dayhoff-prototype/frontend
npm install && npm run dev
```

Open http://localhost:5173 for the web interface.

## Documentation

| Document | Purpose |
|----------|--------|
| `docs/quick-start.md` | Hello world (CPU or GPU), enterprise vs local paths |
| `docs/application-patterns.md` | API reference, unconditional design, mutation scoring |
| `docs/prototype-expansion.md` | Extending the reference app with custom features |
| `docs/data-integration.md` | GigaRef/BackboneRef/DayhoffRef dataset loading |
| `docs/performance-guide.md` | Hardware sizing, batching, throughput optimization |
| `docs/troubleshooting.md` | mamba-ssm, CUDA, HTTP 401, rate limits |
| `docs/alignment-constitution.md` | Responsible use and biosecurity guardrails |

## Dayhoff Atlas for Protein Design
Dayhoff Atlas combines 3.34 billion metagenomic proteins, RFDiffusion-derived synthetic backbones, and Dayhoff-generated sequences with a hybrid Mamba + Transformer + Mixture-of-Experts architecture. This kit delivers a rapid Dayhoff hello-world (CLI + Flask UI), vetted data-loading guides for Dayhoff Atlas corpora, and turnkey workflows for unconditional design, zero-shot mutation prioritization, and custom downstream integration. Use it to bootstrap wet-lab triage pipelines within a single working session while staying aligned with Microsoft's responsible-use guidance.