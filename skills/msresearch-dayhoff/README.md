# Dayhoff — Microsoft Research Agent Skill

Dayhoff is Microsoft Research's family of protein language models for generating novel protein sequences and scoring variants — trained on the 3.34-billion-sequence Dayhoff Atlas using a hybrid Mamba + Transformer + Mixture-of-Experts architecture.

This kit teaches you how to run the Dayhoff reference app locally in three modes: a frontend-only **cached demo** (no GPU, no backend, four bundled prompts), **proxy mode** against a deployed Azure ML endpoint, or **fully local** with a self-hosted `score/` server on a CUDA-capable NVIDIA GPU. The reference app lives in [`assets/dayhoff-prototype/`](assets/dayhoff-prototype/).

## Docs

| Doc | Purpose |
|---|---|
| [About Dayhoff](docs/about-dayhoff.md) | What Dayhoff is, the four model variants, capabilities, benchmarks |
| [Quick Start](docs/quick-start.md) | Path A (cached demo, no GPU), Path B (proxy mode), Path C (fully local with self-hosted score server) |
| [Application Patterns](docs/application-patterns.md) | Generation, fitness scoring, motif preservation, batch sampling, export |
| [Data Integration](docs/data-integration.md) | Load Dayhoff Atlas datasets (GigaRef, BackboneRef, DayhoffRef) |
| [Prototype Expansion](docs/prototype-expansion.md) | Add custom endpoints, scoring filters, batch jobs, persistence |
| [Performance Guide](docs/performance-guide.md) | GPU sizing, throughput, scaling |
| [Troubleshooting](docs/troubleshooting.md) | GPU, WSL2/Windows, weight download, AML auth, multi-terminal mistakes |
| [Responsible Use](docs/responsible-use.md) | **Read before exporting any sequence.** Biosecurity guardrails + pre-export checklist. |

## Links

- Skill definition: [SKILL.md](./SKILL.md)
- Research paper (preprint): https://aka.ms/dayhoff/preprint
- GitHub: https://github.com/microsoft/dayhoff
- Hugging Face model collection: https://huggingface.co/collections/microsoft/dayhoff-atlas-6866d679465a2685b06ee969
- Azure AI Foundry: https://ai.azure.com/catalog/models/Dayhoff-170m-GR

## Install

```bash
npx skills add microsoft/vibe-kit/skills/msresearch-dayhoff
```
