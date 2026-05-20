# BioEmu — Microsoft Research Agent Skill

BioEmu is Microsoft Research's deep learning model for sampling protein equilibrium structural ensembles from amino acid sequence — generating thousands of conformations per hour and capturing domain motions, local unfolding, and cryptic pockets.

This kit teaches you how to run BioEmu locally on a CUDA-capable NVIDIA GPU, either via the upstream `bioemu` PyPI package directly, or via the React + Flask reference app in [`assets/reference-app/`](assets/reference-app/) pointed at its bundled `score/` Flask server running on localhost.

## Docs

| Doc | Purpose |
|---|---|
| [About BioEmu](docs/about-bioemu.md) | What BioEmu is, how it works, performance, limitations |
| [Quick Start](docs/quick-start.md) | Path A (CLI smoke test) and Path B (full reference app + local `score/`) |
| [Application Patterns](docs/application-patterns.md) | Python sampling API, MDTraj analysis, output file formats |
| [Troubleshooting](docs/troubleshooting.md) | GPU, WSL2/Windows, weight download, MMseqs MSA, port, Docker fixes |

## Links

- Skill definition: [SKILL.md](./SKILL.md)
- Science paper: https://www.science.org/doi/10.1126/science.adv9817
- GitHub: https://github.com/microsoft/bioemu
- Hugging Face: https://huggingface.co/microsoft/bioemu

## Install

```bash
npx skills add microsoft/vibe-kit/skills/msresearch-bioemu
```
