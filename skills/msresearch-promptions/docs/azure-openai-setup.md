# Azure OpenAI Setup for Promptions Chat

This guide walks self-hosters of the Promptions chatbot through provisioning a GPT-4-family deployment on **Azure OpenAI** and wiring it into the per-app `.env` files. Azure OpenAI is the strongly preferred credential path for `promptions-chat`.

> **Skip this doc if** you're using the hosted [ImageGen Workbench demo](https://www.microsoft.com/en-us/research/workbench/project/promptions/demo) — it requires nothing. This guide is the strongly preferred credential path for self-hosting `promptions-chat`. If you genuinely can't use Azure (organizational restrictions, no account access), [quick-start.md §2.2b](./quick-start.md) documents a public-OpenAI fallback — but Azure is the supported path.

---

## Path A — Automated (recommended)

The kit ships a one-shot provisioning script that creates the resource group, Azure OpenAI account, and model deployment, smoke-tests the deployment, and writes the four required values into `promptions-app/apps/promptions-chat/.env` and `promptions-app/apps/promptions-image/.env`.

### Prerequisites

- An **Azure subscription** with Azure OpenAI access. No subscription yet? Create one at <https://azure.microsoft.com/free>, then return here. Most subscriptions get default access; if your tenant gates it, request access at [aka.ms/oai/access](https://aka.ms/oai/access).
- Sufficient **quota** for the chosen model in the chosen region. If the script fails with a quota error, request more at [aka.ms/oai/quotaincrease](https://aka.ms/oai/quotaincrease).
- **Azure CLI (`az`)** installed and logged in. Install: <https://learn.microsoft.com/cli/azure/install-azure-cli>. Then run `az login`.
- The `promptions-app/` repo cloned (per [quick-start.md §2.1](./quick-start.md)). The script writes into `promptions-app/apps/promptions-chat/.env` and `promptions-app/apps/promptions-image/.env`.

### Run it

From the kit root:

```bash
./assets/scripts/provision-azure-openai.sh
```

The script prompts for:

| Prompt                                       | Default                       | Notes                                                  |
| -------------------------------------------- | ----------------------------- | ------------------------------------------------------ |
| Subscription ID                              | your current default          | Run `az account list` to see options                   |
| Resource group name                          | `promptions-rg`               | Created if missing                                     |
| Region                                       | `eastus2`                     | See "Region availability" below                        |
| Cognitive Services resource name             | `promptions-aoai-<random>`    | Must be globally unique                                |
| Deployment name (= `VITE_OPENAI_MODEL`)      | `promptions-chat`             | This is what you'll set `VITE_OPENAI_MODEL` to         |
| Model                                        | `gpt-4.1-mini`                | Fallbacks: `gpt-4o-mini`, `gpt-4o`                     |
| Model version                                | `2025-04-14`                  | **Required by Azure CLI.** Update if Azure rotates GA. |
| Azure OpenAI REST API version                | `2024-12-01-preview`          | Matches upstream `microsoft/Promptions` documentation  |

Press `y` to confirm the plan. The script:

1. Creates the resource group if it doesn't exist.
2. Creates an Azure OpenAI (`Cognitive Services`, kind `OpenAI`, sku `S0`) account.
3. Deploys the chosen model + version with sku `Standard` and capacity `10`.
4. Reads back the endpoint and key 1.
5. Smoke-tests with a `chat/completions` request — must return HTTP 200.
6. Writes `VITE_OPENAI_API_KEY`, `VITE_OPENAI_BASE_URL`, `VITE_OPENAI_API_VERSION`, `VITE_OPENAI_MODEL` into `promptions-app/apps/promptions-chat/.env` **and** `promptions-app/apps/promptions-image/.env` (backing up any existing files).

The script is **idempotent** — re-running with the same names is safe. Existing resources are detected and skipped.

### Useful flags

- `--dry-run` — print the plan and exit without creating anything.
- `--non-interactive` — skip prompts; uses defaults plus any `AZ_*` env-var overrides (see the script header for the full list).

### Model version is required

Azure CLI's `az cognitiveservices account deployment create` requires `--model-version` explicitly; there is no "latest" auto-pick. The script defaults to `2025-04-14` for `gpt-4.1-mini`. When Azure rotates the recommended GA version, update the default in the script (`AZ_MODEL_VERSION` prompt) and in this doc. The current model + version matrix lives at <https://learn.microsoft.com/azure/ai-services/openai/concepts/models#model-summary-table-and-region-availability>.

### Region availability

`gpt-4.1-mini` is hosted in many regions but not all. The script defaults to `eastus2`, which has broad coverage. If the deployment fails with a "model not available" error, either:

- Pick a different region (e.g., `swedencentral`, `westus3`) and re-run, or
- Pick a fallback model (`gpt-4o-mini`, `gpt-4o`) — both are GPT-4-family and compatible with `promptions-chat`.

Current model-region matrix: <https://learn.microsoft.com/azure/ai-services/openai/concepts/models#model-summary-table-and-region-availability>

---

## Path B — Manual (Azure AI Foundry portal)

If you don't have / don't want the `az` CLI, click through Azure AI Foundry instead.

### 1. Create or open a project

1. Go to <https://ai.azure.com>.
2. Sign in with your Azure account.
3. Create a new project (or pick an existing one). Pick a region — `eastus2` is a safe default for `gpt-4.1-mini`.

### 2. Deploy a base model

1. In the left rail, open **Deployments** → **Deploy model** → **Deploy base model**.
2. Search for `gpt-4.1-mini` (fallbacks: `gpt-4o-mini`, `gpt-4o`).
3. **Pick a model version** from the dropdown (Foundry preselects a recent GA version — `2025-04-14` is a good current default for `gpt-4.1-mini`). Record this value; you'll need it if you ever recreate the deployment via CLI.
4. Click **Confirm**.
5. **Deployment name:** pick something memorable, e.g., `promptions-chat`. **Write this down — it's what `VITE_OPENAI_MODEL` will be set to, not the model name.**
6. Leave deployment type as **Standard**, capacity ~10 TPM.
7. Click **Deploy**.

### 3. Copy the four required values

After the deployment lands:

| Value            | Where to find it in Foundry                                  | Maps to                    |
| ---------------- | ------------------------------------------------------------ | -------------------------- |
| API key          | Project settings → **Keys and endpoint** → copy `KEY 1`      | `VITE_OPENAI_API_KEY`      |
| Endpoint URL     | Project settings → **Keys and endpoint** → copy `Endpoint`   | `VITE_OPENAI_BASE_URL`     |
| API version      | Use `2024-12-01-preview` (matches upstream docs)             | `VITE_OPENAI_API_VERSION`  |
| Deployment name  | The name you chose in step 2.5 (e.g., `promptions-chat`)     | `VITE_OPENAI_MODEL`        |

> **Watch the URL shape.** `VITE_OPENAI_BASE_URL` must be just `https://<resource>.openai.azure.com` — **no `/openai` suffix**. The `AzureOpenAI` SDK client used by `promptions-chat` appends `/openai/deployments/...` itself; if you add the suffix, the request becomes `.../openai/openai/deployments/...` and returns `404 Resource not found`. Only raw REST `curl` calls (like the smoke test below) need `/openai/` in the URL template.

### 4. Wire into `.env`

Open `promptions-app/apps/promptions-chat/.env` (create it from `apps/promptions-chat/.env.example` if missing) and set:

```dotenv
VITE_OPENAI_API_KEY=<the KEY 1 you copied>
VITE_OPENAI_BASE_URL=https://<your-resource>.openai.azure.com
VITE_OPENAI_API_VERSION=2024-12-01-preview
VITE_OPENAI_MODEL=<your deployment name, e.g. promptions-chat>
```

Do the same for `promptions-app/apps/promptions-image/.env` if you also want to run the image app — it reads the same four `VITE_OPENAI_*` vars.

### 5. Smoke-test

Replace the placeholders and run:

```bash
set -a && source promptions-app/apps/promptions-chat/.env && set +a
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST "${VITE_OPENAI_BASE_URL}/openai/deployments/${VITE_OPENAI_MODEL}/chat/completions?api-version=${VITE_OPENAI_API_VERSION}" \
  -H "Content-Type: application/json" \
  -H "api-key: $VITE_OPENAI_API_KEY" \
  -d '{"messages":[{"role":"user","content":"ping"}],"max_tokens":5}'
```

Note the `/openai/` segment in the URL template — that's needed for raw REST calls only. Your `VITE_OPENAI_BASE_URL` env var must NOT include it.

`200` means you're good. See [Troubleshooting](#troubleshooting) for non-200 codes.

---

## Troubleshooting

| Symptom                              | Likely cause                                                                                                                            |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `401 Unauthorized`                    | Wrong API key, or you used `Authorization: Bearer` instead of `api-key:` (Azure OpenAI uses `api-key`, not bearer auth).                |
| `404 DeploymentNotFound`              | `VITE_OPENAI_MODEL` is set to the **model name** (`gpt-4.1-mini`) instead of your **deployment name**. Set it to the deployment name.  |
| `404 Resource not found` (from the app, not curl) | `VITE_OPENAI_BASE_URL` has a stray `/openai` suffix. The `AzureOpenAI` SDK appends `/openai/...` itself. Strip the suffix — the env var must be just `https://<resource>.openai.azure.com`. |
| `404 Resource not found` (from raw curl) | The raw REST URL template is missing `/openai/`. The smoke test uses `${VITE_OPENAI_BASE_URL}/openai/deployments/...`, not `${VITE_OPENAI_BASE_URL}/deployments/...`. |
| `Model 'gpt-4.1-mini' version '' is not supported` | `--model-version` was empty. Azure CLI requires a version; pass `2025-04-14` (or update if Azure has rotated GA).                  |
| `429 Too Many Requests`               | Capacity exhausted. Either wait, increase deployment capacity in Foundry, or request more quota: <https://aka.ms/oai/quotaincrease>.    |
| `Model 'gpt-4.1-mini' not available`  | Model isn't hosted in your chosen region. Try a different region or fall back to `gpt-4o-mini` / `gpt-4o`.                              |
| Script aborts on `az login`           | Azure CLI not authenticated. Run `az login` and retry.                                                                                   |

---

## Production notes

- **Auth.** This walkthrough uses **API keys** for simplicity. For production, prefer **Microsoft Entra ID** (managed identity / service principal) so you don't have a long-lived secret in `.env`. See <https://learn.microsoft.com/azure/ai-services/authentication>. Wiring Entra into `promptions-chat` requires app-level changes and is out of scope here.
- **Secret hygiene.** Don't commit any `.env` under `promptions-app/apps/`. The script writes backups to `<env-path>.bak.<timestamp>` if a prior file existed — delete those backups before pushing.
- **Cost.** Azure OpenAI bills per 1K tokens; `gpt-4.1-mini` is one of the cheapest GPT-4-family options. Monitor in the Azure portal.

---

## Reference links

- Azure OpenAI overview: <https://learn.microsoft.com/azure/ai-services/openai/overview>
- Model + region availability: <https://learn.microsoft.com/azure/ai-services/openai/concepts/models#model-summary-table-and-region-availability>
- Quota increase request: <https://aka.ms/oai/quotaincrease>
- Azure OpenAI access (if your tenant gates it): <https://aka.ms/oai/access>
- Authentication options: <https://learn.microsoft.com/azure/ai-services/authentication>
- `az cognitiveservices` CLI reference: <https://learn.microsoft.com/cli/azure/cognitiveservices/account>
