---
description: BioEmu Innovation Kit context and file locations for protein conformational ensemble analysis
applyTo: "**/*"
---

# BioEmu Innovation Kit

**Invoke when**: User mentions "BioEmu", "protein ensemble", "conformational sampling", "protein dynamics", "Boltzmann distribution", "cryptic pockets", "protein flexibility", or "equilibrium structures"

## What is BioEmu?

Microsoft's deep learning model that samples from protein equilibrium structural ensembles (Boltzmann distribution) given only the amino acid sequence. Key capabilities:

- Generate thousands of statistically independent conformations per hour on single GPU
- Capture conformational changes: domain motions, local unfolding, cryptic pockets
- Predict folding free energies with ~0.9 kcal/mol accuracy
- Orders of magnitude faster than molecular dynamics simulations

## Kit Location

`.vibe-kit/innovation-kits/bioemu/`

This is the installed kit location in the user's workspace (installed via `vibekit install bioemu`). All paths in this document are relative to this location.

> **For kit developers**: The source files live at `innovation-kit-repository/bioemu/` in the vibe-kit repo.

## Security Rules

- **NEVER** request, display, or echo API keys, credentials, or secrets
- If credentials are missing, state generically ("Set credentials in `.env`") and link to docs

## File Index

All paths relative to `.vibe-kit/innovation-kits/bioemu/`

### Documentation

| File                           | When to Read                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| `docs/quick-start.md`          | User wants to launch the reference app. Follow the setup steps exactly.             |
| `docs/azure-setup.md`          | User needs help deploying BioEmu on Azure AI Foundry.                               |
| `docs/model-details.md`        | User asks what BioEmu can/can't do, accuracy metrics, architecture, or limitations. |
| `docs/application-patterns.md` | User wants Python code examples for sampling, analysis, or mutation scoring.        |
| `docs/data-integration.md`     | User asks about API request/response formats, file types (PDB, XTC, FASTA).         |
| `docs/troubleshooting.md`      | User reports errors, installation issues, or unexpected behavior.                   |

### Reference Application

| File                                       | Description                                            |
| ------------------------------------------ | ------------------------------------------------------ |
| `assets/reference-app/`                    | React frontend + Flask backend (full app)              |
| `assets/reference-app/README.md`           | Project structure, components, and customization guide |
| `assets/reference-app/server/.env.example` | Template for Azure credentials                         |
| `assets/reference-app/server/app.py`       | Backend entry point                                    |

## Official Resources

- GitHub: https://github.com/microsoft/bioemu
- Azure AI Foundry: https://ai.azure.com/explore/models/BioEmu
- Paper: Science, 2025, DOI: 10.1126/science.adv9817
