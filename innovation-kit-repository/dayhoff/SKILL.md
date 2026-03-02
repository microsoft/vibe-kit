---
name: dayhoff
description: Dayhoff Atlas accelerates protein design by pairing trillion-token training data with hybrid Mamba-Transformer models for rapid sequence generation and mutation scoring.
license: MIT
---
## Activation Conditions

Activate when users ask for Dayhoff sequence generation, mutation scoring, dataset integration, prototype launch, or performance tuning.

## Scope Boundaries

- Keep workflows aligned with responsible-use requirements from `docs/alignment-constitution.md`.
- Enforce safe execution patterns for backend/frontend startup.

## Reference App Details

- Backend path: `assets/dayhoff-prototype/backend`.
- Frontend path: `assets/dayhoff-prototype/frontend`.
- Start backend in terminal A and frontend in terminal B.
- Avoid polling commands and warn about first-run model download time.

## Workflow

1. Confirm safety and credential constraints before sequence generation tasks.
2. For prototype launch, run backend and frontend in separate terminals.
3. Do not use polling commands to check service status.
4. Start backend first, then frontend, and warn about first-run model download.
5. Route feature and integration requests to the appropriate documentation.

## Routing

- `docs/quick-start.md` for hello world and launch steps.
- `docs/application-patterns.md` for generation and mutation-scoring methods.
- `docs/data-integration.md` for atlas dataset and file-format integration.
- `docs/prototype-expansion.md` for extending the reference app.
- `docs/performance-guide.md` and `docs/troubleshooting.md` for runtime optimization and debugging.

## Domain Summary

Dayhoff Atlas combines large-scale metagenomic and synthetic protein corpora with hybrid model architectures to support rapid sequence ideation and mutation prioritization.

## Reference Links

- Azure AI Foundry Model Catalog: https://ai.azure.com/catalog/models/Dayhoff-170m-GR
- GitHub: https://github.com/microsoft/dayhoff
- Research Paper: https://aka.ms/dayhoff/preprint
- Dayhoff Atlas Collection: https://huggingface.co/collections/microsoft/dayhoff-atlas-6866d679465a2685b06ee969