---
name: msresearch-promptions
description: Promptions — Microsoft Research's dynamic prompt middleware that turns a user's prompt into ephemeral UI controls (sliders, toggles, selects) they can adjust and replay to steer model output without rewriting instructions. Use for integrating Promptions, designing control schemas, rendering controls in React/Fluent UI, or showcasing the hosted ImageGen Workbench demo (the recommended first-look) or the self-hosted `promptions-chat` reference app.
license: MIT
---

## Choosing the right path

Identify which journey the user is on before touching files:

1. **"What is Promptions?"** → start with the background doc, then route to a path below.
   - Route: [docs/about-promptions.md](docs/about-promptions.md).
2. **"Show me Promptions in action"** → open the **hosted ImageGen Workbench demo** (recommended, zero setup) or self-host `promptions-chat` locally. Lowest commitment, visual payoff.
   - Route: [docs/quick-start.md](docs/quick-start.md).
3. **"I want to integrate Promptions into my own app"** → start with the design playbook in [docs/application-patterns.md](docs/application-patterns.md) (Design First → Wire It Up), then study the TypeScript modules and replicate the generate → validate → render → replay loop in your stack.
   - Route: [docs/application-patterns.md](docs/application-patterns.md) → [lib/control-schema.ts](lib/control-schema.ts) → [docs/data-integration.md](docs/data-integration.md).

If the user is undecided, default to path 2 — and within path 2, default to **ImageGen**: it's the most impressive, takes zero setup, and makes the pattern click in seconds. Only walk through the self-hosted chatbot if the user wants to see code, fork it, or run against their own key.

## Scope

- Generating, validating, rendering, and replaying ephemeral prompt controls.
- Schema design for control surfaces (options, sliders, toggles, multi-select).
- Integrating Promptions middleware into existing chat or generation copilots.
- Out of scope: model fine-tuning. Promptions is a prompting/middleware pattern, not a training recipe. Do not invent training workflows.
- Out of scope: replacing the host application's UI framework. Render examples target React + Fluent UI v9; users are expected to adapt to their own framework.

## Prerequisites

> **Hosted ImageGen demo:** the only prereq is a modern browser — open <https://www.microsoft.com/en-us/research/workbench/project/promptions/demo> and you're done. The items below apply to the **optional** self-hosted chatbot path.

- **Windows users (chatbot path):** run inside a **WSL2** distro (Ubuntu recommended); native Windows PowerShell/cmd has not been tested. Vite dev-server pathing, `corepack`, and `--host 0.0.0.0` IPv6 behavior all work as documented only in WSL2. See [Microsoft's WSL install guide](https://learn.microsoft.com/windows/wsl/install).
- Node.js 18+ with `corepack` (ships with Node) or `npx`.
- **GPT-4-family deployment — Azure OpenAI is strongly preferred.** The kit ships a one-shot provisioning script — see [docs/azure-openai-setup.md](docs/azure-openai-setup.md). Public OpenAI (`api.openai.com`) is supported only as a fallback for users who cannot use Azure. The chatbot requires a GPT-4-family model (e.g., `gpt-4.1-mini`); GPT-5 is **not** compatible.
- React 18 + Fluent UI v9 if rendering controls in the browser (the bundled apps already include this).
- ~1 GB free disk space; CPU-only is fine.

## Workflow

1. **Decide the path** (see "Choosing the right path") before installing anything.
2. **Reference-app path (showcase ImageGen first):**
   1. **Open the hosted [ImageGen Workbench demo](https://www.microsoft.com/en-us/research/workbench/project/promptions/demo)**. No clone, no install, no key. Let the user type their own prompt, observe generated controls, adjust, and regenerate.
   2. *Only if the user wants to see the integration code or self-host:* walk through the chatbot setup in [docs/quick-start.md §2](docs/quick-start.md). Clone first (`git clone https://github.com/microsoft/Promptions.git promptions-app`), then run the Azure OpenAI provisioning script ([docs/azure-openai-setup.md](docs/azure-openai-setup.md)) — it creates the deployment and writes `apps/promptions-chat/.env` and `apps/promptions-image/.env` in one shot. Public OpenAI is a documented fallback only for users who can't use Azure. Then `corepack yarn install && corepack yarn build`, and from `promptions-app/apps/promptions-chat/` run `npx vite --host 0.0.0.0 --port 3003`.
   3. In either app, the loop is the same: send a prompt, observe generated controls, adjust, watch the replayed response.
3. **Integration path:**
   1. Read [lib/control-schema.ts](lib/control-schema.ts) for the canonical type definitions.
   2. Wire generation with [lib/generate-controls.ts](lib/generate-controls.ts).
   3. Always pass generated schemas through [lib/validate-controls.ts](lib/validate-controls.ts) before rendering.
   4. Render with [lib/render-controls.tsx](lib/render-controls.tsx) (or your framework's equivalent).
   5. Replay user selections with [lib/replay-selections.ts](lib/replay-selections.ts) and request the final response.
4. **Domain customization:** apply patterns from [docs/application-patterns.md](docs/application-patterns.md); shape transcripts and telemetry per [docs/data-integration.md](docs/data-integration.md).
5. **Tune & debug:** route runtime issues to [docs/troubleshooting.md](docs/troubleshooting.md) and latency/cost work to [docs/performance-guide.md](docs/performance-guide.md).

### Operational notes

- **Vite dev-server hygiene:** the dev server must keep running in its own terminal. Open a *new* terminal for follow-up commands so you don't kill it. When the agent supports background terminals, launch the dev server with `isBackground: true` and use `get_terminal_output` to verify the server started — never run additional commands in the same background terminal.
- **App-directory trap:** `npx vite` for `promptions-chat` must run from inside `promptions-app/apps/promptions-chat/`. Running from the kit root, workspace root, or repo root produces confusing errors.
- **Use `npx vite`, not `corepack yarn workspace ... dev`:** Yarn 4 hoists deps and skips local `.bin` symlinks; the workspace command fails with "permission denied: vite". Don't run `corepack enable` either — it requires root in dev containers.
- **Always pass `--host 0.0.0.0`:** Vite v7 binds to IPv6 `::1` by default, breaking dev-container port forwarding. Without this flag the app won't load in any browser.
- **Azure deployment-name trap:** when the user opts for Azure OpenAI, confirm `VITE_OPENAI_MODEL` is set to the **deployment name** they chose in Foundry (or in the provisioning script), not the underlying model name (`gpt-4.1-mini`). This is the #1 Azure misconfiguration and produces `404 DeploymentNotFound`. See [docs/azure-openai-setup.md](docs/azure-openai-setup.md).
- **Azure endpoint trap: no `/openai` suffix.** `VITE_OPENAI_BASE_URL` must be just `https://<resource>.openai.azure.com`. The `AzureOpenAI` SDK class used by `promptions-chat` appends `/openai/deployments/...` itself; adding the suffix makes the request `.../openai/openai/deployments/...` and returns `404 Resource not found`. Only raw REST `curl` calls (e.g., the smoke test) need `/openai/` in the URL template, never in the env var.
- **Azure model-version trap:** Azure CLI's `az cognitiveservices account deployment create` requires `--model-version` explicitly — there is no "latest" auto-pick. The provisioning script defaults to `2025-04-14` for `gpt-4.1-mini`. If the user reports `Model 'gpt-4.1-mini' version '' is not supported`, the version field was blanked out; re-run with `AZ_MODEL_VERSION=2025-04-14` or check the current GA at <https://learn.microsoft.com/azure/ai-services/openai/concepts/models>.
- **`.env` lives at the per-app level:** `promptions-app/apps/promptions-chat/.env` (chat) and `promptions-app/apps/promptions-image/.env` (image), not the repo root. Both apps read the same four `VITE_OPENAI_*` vars. The provisioning script writes both.
- **"I don't have a key yet" → walk the user through Azure provisioning, do not pivot to public OpenAI.** When a user says they lack credentials, default to the Azure OpenAI provisioning script ([docs/azure-openai-setup.md](docs/azure-openai-setup.md)) — even if they sound hesitant about Azure. Do **not** offer the public-OpenAI fallback as a "simpler" or "easier" alternative, and never frame it as "no Azure account required." The Azure path is strongly preferred even though it has more env vars, because the script automates the provisioning and it's the supported production path. Only point the user at [quick-start.md §2.2b](docs/quick-start.md) if they explicitly state they cannot use Azure (org restrictions, account-creation blocked, etc.).
- **Secret hygiene:** never accept, display, or commit OpenAI / Azure OpenAI keys. Instruct the user to edit `.env` locally and confirm it's set before launching. Validate the key with the `curl` check from [docs/quick-start.md](docs/quick-start.md) before doing anything else — a bad key wastes minutes of confusing errors.
- **Validate before render:** always run generated schemas through the validation utilities before sending them to UI. Malformed JSON from the model is the most common failure mode.
- **Lead with ImageGen.** Open the hosted Workbench demo *first* when introducing Promptions visually. It's the fastest path to the "aha" moment (zero setup, visual output). Only walk through the self-hosted chatbot if the user explicitly wants to see the code, fork it, or run against their own key.
- **Lead with the apps, not the code:** when introducing Promptions, run the reference apps first. Only point users at `lib/` after they've seen the pattern in action.
- **Let the user drive:** never run demos autonomously with canned prompts. The point of Promptions is interactive steering — the user should type their own prompt and adjust their own controls.
- **No mock backends:** the reference apps work end-to-end with a real OpenAI key. Don't suggest stub APIs or mock services.
- **Execute, don't display:** when terminal execution is available, run quick-start commands directly via the terminal tool rather than printing bash blocks for the user to copy. Show bash blocks only when reviewing or when the user explicitly wants to copy commands.
- **Open the URL when you can:** after the dev server reports `Local: http://localhost:3003`, open it for the user with the browser tool if available. For the hosted ImageGen demo, open <https://www.microsoft.com/en-us/research/workbench/project/promptions/demo> directly.
- **Model defaults:** the chatbot requires a GPT-4-family model (e.g., `gpt-4.1-mini`, `gpt-4.1`); GPT-5 is not compatible. For Azure OpenAI (strongly preferred), all four `VITE_OPENAI_*` values are populated by the provisioning script ([docs/azure-openai-setup.md](docs/azure-openai-setup.md)) into both `apps/promptions-chat/.env` and `apps/promptions-image/.env`. If — and only if — the user has explicitly opted into the public-OpenAI fallback, set `VITE_OPENAI_API_KEY` and `VITE_OPENAI_MODEL=gpt-4.1` (upstream's documented default) and leave `VITE_OPENAI_BASE_URL` and `VITE_OPENAI_API_VERSION` unset — the absence of `VITE_OPENAI_BASE_URL` is what tells `promptions-chat` to use the standard OpenAI client instead of `AzureOpenAI`.

## Routing

| Doc | When to load |
|---|---|
| [docs/about-promptions.md](docs/about-promptions.md) | User asks what Promptions is, how it works, key results, limitations, or background |
| [docs/quick-start.md](docs/quick-start.md) | User wants to try ImageGen (hosted, recommended first-look) or self-host `promptions-chat` |
| [docs/azure-openai-setup.md](docs/azure-openai-setup.md) | User wants to provision an Azure OpenAI GPT deployment for the self-hosted chatbot (automated script + manual Foundry walkthrough) |
| [docs/application-patterns.md](docs/application-patterns.md) | User wants to design a new Promptions experience, see integration code, or adapt domain workflows (customer support, content ops, analytics, marketing, education) |
| [docs/data-integration.md](docs/data-integration.md) | User asks about transcripts, telemetry ingestion, or shaping chat history into control inputs |
| [docs/reference.md](docs/reference.md) | User needs full schema details or type reference |
| [docs/performance-guide.md](docs/performance-guide.md) | User asks about latency, cost, batching, or model selection |
| [docs/troubleshooting.md](docs/troubleshooting.md) | User hits an error, malformed control output, or replay failure |

## Assets

- `lib/` — TypeScript modules covering schema, generation, validation, React rendering, and replay. Canonical reference for the integration path.
- `assets/papers/` — CHIWORK 2025 paper artifacts for offline reference; surfaced from [docs/about-promptions.md](docs/about-promptions.md).
- `assets/scripts/provision-azure-openai.sh` — One-shot Azure OpenAI provisioning script. Creates the resource group + Azure OpenAI account + GPT-4-family deployment (with explicit `--model-version`), smoke-tests it, and writes the four required `VITE_OPENAI_*` values into both `promptions-app/apps/promptions-chat/.env` and `promptions-app/apps/promptions-image/.env`. See [docs/azure-openai-setup.md](docs/azure-openai-setup.md).
- `promptions-app/` — Chatbot reference app cloned from [github.com/microsoft/Promptions](https://github.com/microsoft/Promptions) during quick-start setup.

## Reference Links

- Microsoft Workbench project page: [microsoft.com/en-us/research/workbench/project/promptions](https://microsoft.com/en-us/research/workbench/project/promptions) — hosted ImageGen demo lives here
- Research paper: [Dynamic Prompt Middleware for Generative AI](https://arxiv.org/abs/2412.02357) (CHIWORK 2025)
- GitHub: [github.com/microsoft/Promptions](https://github.com/microsoft/Promptions) — chatbot reference app source
- Microsoft Research project page: [Tools for Thought](https://www.microsoft.com/en-us/research/project/tools-for-thought)
- AI Foundry Labs: [ai.azure.com/explore/foundry-labs](https://ai.azure.com/explore/foundry-labs)
