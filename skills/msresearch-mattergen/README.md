# MatterGen — Microsoft Research Agent Skill

MatterGen is a property-steerable diffusion model from Microsoft Research that generates inorganic crystal candidates conditioned on target properties (bulk modulus, band gap, magnetic density, supply-chain HHI risk, and more).

This skill covers local CUDA workflows, Azure AI Foundry hosted inference, MatterSim triage, and adapter fine-tuning for custom properties.

## Docs

| Doc | Purpose |
|---|---|
| [About MatterGen](docs/about-mattergen.md) | What MatterGen and MatterSim are, how they work, why they matter |
| [Prototype Web App](docs/prototype.md) | Run the local web UI to play with MatterGen + MatterSim — demo mode requires no Azure |
| [Quick Start](docs/quick-start.md) | Install MatterGen, generate 16 samples, try the hosted endpoint |
| [Application Patterns](docs/application-patterns.md) | Six end-to-end scenarios with prompts and metrics |
| [Data Integration](docs/data-integration.md) | Datasets, preprocessing, custom property adapters |
| [Performance Guide](docs/performance-guide.md) | Hardware sizing, throughput, fine-tuning, hosted cost |
| [Emergency Fixes](docs/emergency-fixes.md) | Git LFS, CUDA, MatterSim, hosted endpoint errors |
| [Alignment Constitution](docs/alignment-constitution.md) | Responsible-use guardrails and oversight |

## Links

- Skill definition: [SKILL.md](./SKILL.md)
- Research paper: https://www.nature.com/articles/s41586-025-08628-5
- GitHub: https://github.com/microsoft/mattergen
- Hugging Face: https://huggingface.co/microsoft/mattergen
- Azure AI Foundry: https://ai.azure.com/catalog/models/MatterGen

## Install

```bash
npx skills add microsoft/vibe-kit/skills/msresearch-mattergen
```
