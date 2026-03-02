---
name: bioemu
description: Generate and analyze protein conformational ensembles using BioEmu.
license: MIT
---
## Activation Conditions

Activate when users ask about BioEmu sampling, protein conformational ensembles, equilibrium structures, cryptic pockets, or protein dynamics analysis.

## Scope Boundaries

- Focus on setup, inference routing, and output interpretation guidance.
- Enforce credential safety rules and avoid exposing secrets.

## Quick Context

- Reference app backend: `assets/reference-app/server`.
- Reference app frontend: `assets/reference-app`.
- Backend and frontend installs may each take several minutes on first run.
- Configure credentials in `.env` without exposing secret values.

## Included Capabilities

- Ensemble generation and conformational sampling.
- Azure-backed inference integration.
- MDTraj-based trajectory analysis.
- Optional assistant-style workflows.

## Workflow

1. Confirm credentials are configured in `.env` without requesting secret values.
2. Route setup and first-run execution to `docs/quick-start.md`.
3. Route model behavior and limitations to `docs/model-details.md`.
4. Route data formats and integration to `docs/data-integration.md`.
5. Route errors to `docs/troubleshooting.md`.

## Routing

- `docs/quick-start.md` for reference app startup.
- `docs/application-patterns.md` for usage examples.
- `docs/azure-setup.md` for Azure deployment.
- `docs/model-details.md` for capability and limitation questions.

## Additional Resources

- Blog overview: https://www.microsoft.com/en-us/research/blog/exploring-the-structural-changes-driving-protein-function-with-bioemu-1/
- Video overview: https://www.microsoft.com/en-us/research/video/scalable-emulation-of-protein-equilibrium-ensembles-with-bioemu/
- Technical deep dive: https://www.microsoft.com/en-us/research/video/scalable-emulation-of-protein-equilibrium-ensembles-with-bioemu-2/

## Reference Links

- BioEmu on GitHub: https://github.com/microsoft/bioemu
- BioEmu on Azure AI Foundry: https://ai.azure.com/explore/models/BioEmu
