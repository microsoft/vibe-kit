---
name: promptions
description: Promptions workflows for dynamic control generation, validation, and replay in AI copilots.
license: MIT
---
## Activation Conditions

Activate when users ask about Promptions, dynamic controls, structured prompt middleware, control schema design, or replaying user selections into model prompts.

## Scope Boundaries

- Focus on control schema generation, validation, rendering patterns, and selection replay.
- Keep guidance aligned with the provided examples and docs.
- Avoid exposing API keys or secret values.

## Quick Context

- Core workflow is: prompt -> controls -> user selections -> parameterized prompt -> final response.
- Reference implementations are in `examples/` and include generation, validation, replay, and React rendering.
- Public reference applications are available in the Microsoft Promptions repository.

## Prerequisites

- Node.js 18+.
- OpenAI or Azure OpenAI credentials configured in `.env`.
- TypeScript support for integrating the example modules.

## Workflow

1. Configure credentials and validate connectivity.
2. Generate controls via `examples/generate-controls.ts`.
3. Validate schemas via `examples/validate-controls.ts` before rendering.
4. Render controls with your UI framework (`examples/render-controls.tsx` as reference).
5. Replay selections using `examples/replay-selections.ts` and request the final model output.

## Routing

- `docs/quick-start.md` for first-run integration.
- `docs/application-patterns.md` for domain workflows.
- `docs/data-integration.md` for transcript and telemetry patterns.
- `docs/REFERENCE.md` for schema details.
- `docs/troubleshooting.md` and `docs/performance-guide.md` for reliability and optimization.

## Reference Links

- GitHub: https://github.com/microsoft/Promptions
- Research paper: https://arxiv.org/abs/2412.02357
- Microsoft Research project page: https://www.microsoft.com/en-us/research/project/tools-for-thought
- AI Foundry Labs: https://ai.azure.com/explore/foundry-labs
