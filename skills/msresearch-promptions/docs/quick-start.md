# Quick Start

Open the hosted ImageGen Workbench demo in your browser — zero setup, instant payoff. Or self-host the Promptions chatbot locally in ~10 minutes for a deeper look at the code.

## 1. Try ImageGen (hosted, instant) — start here

**Open [https://www.microsoft.com/en-us/research/workbench/project/promptions/demo](https://www.microsoft.com/en-us/research/workbench/project/promptions/demo) in any modern browser.**

That's it. No clone, no install, no API key, no local server. The hosted demo is the fastest path to seeing Promptions in action: type an image prompt, watch dynamic controls (sliders, toggles, selects) appear, adjust them, and regenerate to see the image shift to honor your selections.

**The only prerequisite is a modern browser.**

**What to do once it loads:**

1. Type a prompt — e.g., *"A watercolor of a fox in a moonlit forest."*
2. Observe the 3–6 generated controls (style, mood, lighting, composition, etc.) — these are model-suggested, not pre-defined.
3. Adjust one or two controls, regenerate, and compare. The point of Promptions is interactive steering — drive it yourself.

ImageGen is the recommended starting point. The local chatbot below is optional and aimed at builders who want to inspect or fork the integration code.

---

## 2. Self-Host the Chatbot (optional, ~10 min)

Want to see the generate → validate → render → replay loop end-to-end in code, or run Promptions against your own GPT deployment? Self-host `promptions-chat` locally. **Azure OpenAI is strongly preferred** (§2.2a); public OpenAI (§2.2b) is supported only as a fallback for users who cannot use Azure — don't pick it for convenience.

### Prerequisites (chatbot only)

- **Windows users:** run inside a **WSL2** distro (Ubuntu recommended). The chatbot reference app was developed and tested on WSL2/Ubuntu; native Windows PowerShell/cmd is not supported. See [Microsoft's WSL install guide](https://learn.microsoft.com/windows/wsl/install).
- Node.js 18+ with `corepack` (ships with Node)
- **A GPT-4-family deployment — Azure OpenAI is strongly preferred.** The kit ships a one-shot provisioning script — see [Azure OpenAI setup](./azure-openai-setup.md). Public OpenAI (`api.openai.com`) is supported as a fallback (§2.2b) only for users who can't use Azure.
- **Model compatibility:** `promptions-chat` requires a GPT-4-family model (GPT-5 and newer are **not** compatible) — `gpt-4.1-mini` is a good default.
- ~1 GB free disk space; CPU-only is fine

### 2.1 Clone the chatbot reference app

The chatbot reference app lives in a public Microsoft repo and is not bundled in the kit (so you always get the latest version). Clone it into the kit root:

```bash
git clone https://github.com/microsoft/Promptions.git promptions-app
```

### 2.2 Configure credentials (Azure OpenAI — strongly preferred)

Provision a deployment and write the per-app `.env` files with one command:

```bash
./assets/scripts/provision-azure-openai.sh
```

The script creates an Azure OpenAI resource + GPT-4-family deployment, smoke-tests it, and writes all four required values directly into `promptions-app/apps/promptions-chat/.env` **and** `promptions-app/apps/promptions-image/.env` (both apps read the same `VITE_OPENAI_*` vars). See [Azure OpenAI setup](./azure-openai-setup.md) for the full walkthrough, the manual Azure AI Foundry portal path, and troubleshooting.

#### 2.2a What's in `.env` (Azure)

The script (or manual setup) populates these four values in each app's `.env`:

- `VITE_OPENAI_API_KEY` — your Azure OpenAI key
- `VITE_OPENAI_BASE_URL` — `https://<resource>.openai.azure.com` (**no `/openai` suffix**; the `AzureOpenAI` SDK client appends `/openai/...` itself)
- `VITE_OPENAI_API_VERSION` — e.g. `2024-12-01-preview`
- `VITE_OPENAI_MODEL` — your **deployment name** (e.g. `promptions-chat`), **not** the model name (`gpt-4.1-mini`). Setting this to the model name returns `404 DeploymentNotFound`.

Verify connectivity before continuing (the raw REST `curl` below explicitly includes `/openai/` in the URL template — only the SDK strips/appends it; raw REST needs it):

```bash
set -a && source promptions-app/apps/promptions-chat/.env && set +a
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST "${VITE_OPENAI_BASE_URL}/openai/deployments/${VITE_OPENAI_MODEL}/chat/completions?api-version=${VITE_OPENAI_API_VERSION}" \
  -H "Content-Type: application/json" \
  -H "api-key: $VITE_OPENAI_API_KEY" \
  -d '{"messages":[{"role":"user","content":"ping"}],"max_tokens":5}'
```

`200` means you're good. See [troubleshooting.md](./troubleshooting.md) for non-200 codes.

#### 2.2b Fallback: public OpenAI

**Use this fallback only if §2.2a is genuinely impossible for you** — e.g., your organization blocks Azure or you can't create an Azure account. Azure free-tier signup takes ~5 minutes and includes Azure OpenAI credits; prefer it. Don't pick this path because it has fewer env vars.

If §2.2a is off the table, get a public key from <https://platform.openai.com/api-keys> and create `promptions-app/apps/promptions-chat/.env` (copy from `.env.example` and edit):

- `VITE_OPENAI_API_KEY` — your `sk-...` key from platform.openai.com
- `VITE_OPENAI_MODEL` — `gpt-4.1` (or another GPT-4-family model)
- Leave `VITE_OPENAI_BASE_URL` and `VITE_OPENAI_API_VERSION` unset (or commented out) — that's what tells the app to use the standard OpenAI client instead of `AzureOpenAI`

Verify connectivity:

```bash
set -a && source promptions-app/apps/promptions-chat/.env && set +a
curl -s -o /dev/null -w "%{http_code}\n" https://api.openai.com/v1/models \
  -H "Authorization: Bearer $VITE_OPENAI_API_KEY"
```

`200` means you're good. `401` means the key is wrong — fix it before proceeding.

### 2.3 Install dependencies and build

```bash
cd promptions-app
corepack yarn install
corepack yarn build
```

This compiles the shared `promptions-llm` and `promptions-ui` packages. Both can take several minutes on the first run — do not interrupt them.

### 2.4 Launch the chatbot

`promptions-chat` does **not** support GPT-5; pin a GPT-4-family model. **Keep the dev-server terminal open** — open a new terminal for any follow-up commands.

```bash
cd apps/promptions-chat
npx vite --host 0.0.0.0 --port 3003
```

The `.env` you created in §2.2 (at `apps/promptions-chat/.env`) is read automatically by Vite. Open `http://localhost:3003`, type a prompt, and watch dynamic controls appear.

---

## App comparison

| App        | Port   | Source                                                                                         | What it does                                                                                |
| ---------- | ------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `ImageGen` | hosted | [Microsoft Workbench](https://www.microsoft.com/en-us/research/workbench/project/promptions/demo)       | Recommended first-look. Same flow applied to image generation; hosted — no install, no key  |
| `promptions-chat` | 3003 | `microsoft/Promptions` (self-host)                                                       | Type a prompt, get dynamic controls, tweak parameters, see the response update              |

---

## What success looks like

- **ImageGen (hosted):** the demo loads in your browser; submitting a prompt produces 3–6 controls; adjusting a control and regenerating produces a visibly different image. Latency is governed by the Workbench backend.
- **Chatbot (self-hosted):** the Vite dev server prints `Local: http://localhost:3003` within a few seconds; submitting a prompt produces 3–6 controls within ~2 s on `gpt-4.1-mini`; adjusting a control and regenerating produces a visibly different response.

## Common Pitfalls

> None of the pitfalls below apply to the hosted ImageGen demo — they're chatbot-only.

- **Use `npx vite`, not `corepack yarn workspace ... dev`.** Yarn 4 hoists deps to the root `node_modules` and does not create local `.bin` symlinks, so the workspace command fails with "permission denied: vite". `npx vite` resolves vite from the hoisted root and works reliably.
- **Always pass `--host 0.0.0.0`.** Vite v7 binds to IPv6 `::1` by default, which breaks dev-container port forwarding and "the page won't load" in any browser. The `--host` flag forces all interfaces.
- **Two-terminal hygiene.** The Vite dev server must keep running. Open a new terminal for any other command — running anything in the dev-server terminal kills the server.
- **App-directory trap.** For `promptions-chat`, `npx vite` must run from inside `promptions-app/apps/promptions-chat/` — running from the workspace root or kit root produces confusing module-resolution errors.
- **Azure: deployment name ≠ model name.** When using Azure OpenAI, `VITE_OPENAI_MODEL` must be the **deployment name** you chose in Foundry (or in the provisioning script), *not* `gpt-4.1-mini` literally. Setting it to the model name returns `404 DeploymentNotFound`. See [Azure OpenAI setup](./azure-openai-setup.md).
- **Azure: no `/openai` suffix on the endpoint.** `VITE_OPENAI_BASE_URL` must be just `https://<resource>.openai.azure.com`. The `AzureOpenAI` SDK client appends `/openai/deployments/...` itself; adding the suffix produces `404 Resource not found` because the request becomes `.../openai/openai/deployments/...`. Only raw REST `curl` smoke tests need `/openai/` in the URL template (never in the env var).
- **Don't `corepack enable`.** It requires root permissions in dev containers. Use `corepack yarn ...` directly — corepack ships with Node 16.10+ and just works.
- **Save `.env` before launching.** The most common "nothing works" cause is an unsaved `.env` file. Re-run the smoke-test `curl` from §2.2a (Azure) or §2.2b (public OpenAI) if anything looks off.

## Next Steps

- [About Promptions](./about-promptions.md) — what Promptions is and why it matters
- [Azure OpenAI setup](./azure-openai-setup.md) — provision a GPT-4-family deployment on Azure for the chatbot
- [Application patterns](./application-patterns.md) — design playbook, integration code, and domain workflows
- [Schema reference](./reference.md) — complete control type documentation
- [Troubleshooting](./troubleshooting.md) — error fixes and diagnostics
