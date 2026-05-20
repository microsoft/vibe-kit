# Troubleshooting

Errors and diagnostics for both the bundled reference apps and integration code. Jump to the section matching your context.

- [Reference apps](#reference-apps) — Vite, Yarn, corepack, port forwarding
- [Integration](#integration) — OpenAI, JSON, validation, Azure
- [Quick diagnostics](#quick-diagnostics) — connectivity checks

## Reference Apps

| Issue                          | Fix                                                                                                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `permission denied: vite`      | Yarn 4 hoists deps to root and skips local `.bin` symlinks. Use `npx vite` from the app directory (e.g. `apps/promptions-chat`), not `corepack yarn workspace ... dev`. |
| App won't load in browser      | Vite v7 binds to IPv6 `::1` by default, breaking dev-container port forwarding. Always pass `--host 0.0.0.0`.                                              |
| `corepack enable` fails        | Requires root in dev containers. Skip it — `corepack yarn ...` works directly with Node 16.10+.                                                            |
| Server killed after first cmd  | The Vite dev-server terminal is single-purpose. Open a new terminal for any other command.                                                                 |
| Wrong directory errors         | `npx vite` for `promptions-chat` must run from inside `apps/promptions-chat/`, not the workspace root.                                               |
| `VITE_OPENAI_API_KEY` missing  | The per-app `.env` is missing or empty. For Azure, re-run `./assets/scripts/provision-azure-openai.sh` — it writes both `apps/promptions-chat/.env` and `apps/promptions-image/.env`. For the public-OpenAI fallback, copy from `apps/promptions-chat/.env.example` and set the key manually. |

## Integration

| Issue                          | Fix                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `401 Unauthorized`             | Check `VITE_OPENAI_API_KEY` in the per-app `.env`; re-run the connectivity check below. For Azure, the request header must be `api-key:`, not `Authorization: Bearer`. |
| `429 Rate Limited`             | For Azure (strongly preferred), request quota at <https://aka.ms/oai/quotaincrease> or raise capacity on the deployment. For public OpenAI, add retry with exponential backoff. |
| Invalid JSON from LLM          | Lower `temperature` to `0.3`; ensure the schema is included in the system prompt; log the raw response.       |
| Schema validation fails        | Always run `validateControls()` before rendering. See [reference.md](./reference.md#validation-rules).        |
| Controls not rendering         | Verify the array is non-empty and all required fields are present per [reference.md](./reference.md).         |
| `options` field missing        | Select-style controls require `options`; validation will catch this if you run it before rendering.            |
| Azure: `404 DeploymentNotFound` | `VITE_OPENAI_MODEL` must be the **deployment name** you chose in Foundry / the provisioning script, not the model name (`gpt-4.1-mini`). See [azure-openai-setup.md](./azure-openai-setup.md). |
| Azure: `404 Resource not found` (from the app) | `VITE_OPENAI_BASE_URL` has a stray `/openai` suffix. The `AzureOpenAI` SDK client appends `/openai/...` itself; strip the suffix. Set it to `https://<resource>.openai.azure.com` (no trailing path). |
| Azure: `404 Resource not found` (from raw curl) | The raw REST URL template is missing `/openai/`. Use `${VITE_OPENAI_BASE_URL}/openai/deployments/${VITE_OPENAI_MODEL}/chat/completions?api-version=...`. Raw REST needs `/openai/`; the SDK and env var do not. |
| Azure: `Model 'gpt-4.1-mini' version '' is not supported` | The provisioning script was run with an empty `AZ_MODEL_VERSION`. Azure CLI requires `--model-version` explicitly; pass `2025-04-14` or check the current GA at <https://learn.microsoft.com/azure/ai-services/openai/concepts/models>. |
| Azure: model not available     | Model isn't hosted in the chosen region. Try a different region (e.g., `eastus2`, `swedencentral`) or fall back to `gpt-4o-mini` / `gpt-4o`. Region matrix: <https://learn.microsoft.com/azure/ai-services/openai/concepts/models#model-summary-table-and-region-availability>. |

### JSON extraction issues

If the LLM returns malformed JSON:

1. **Lower `temperature`** to `0.3` during control generation.
2. **Log the raw response** before parsing:
   ```typescript
   const raw = completion.choices[0]?.message?.content ?? "";
   console.log("Raw LLM response:", raw);
   ```
3. **Ensure the schema is included** in the system prompt (`buildControlPrompt` does this automatically).
4. **Use the extraction helper** — it handles code fences and stray text:
   ```typescript
   import { extractControls } from "../lib/generate-controls";
   const controls = extractControls(raw);
   ```

### Validation debugging

```typescript
import { validateControls } from "../lib/validate-controls";

const result = validateControls(controls);
if (!result.valid) {
    console.error("Validation errors:");
    result.errors.forEach((error) => console.error(`  - ${error}`));
}
```

### Azure OpenAI configuration

For provisioning a new Azure OpenAI deployment from scratch, see [azure-openai-setup.md](./azure-openai-setup.md) — it covers both the automated script (`assets/scripts/provision-azure-openai.sh`) and the manual Foundry portal walkthrough.

For an existing deployment, the four values in `promptions-app/apps/promptions-chat/.env` (and `apps/promptions-image/.env`) are:

```bash
VITE_OPENAI_API_KEY=your-azure-api-key
VITE_OPENAI_BASE_URL=https://your-resource.openai.azure.com   # NO /openai suffix
VITE_OPENAI_API_VERSION=2024-12-01-preview
VITE_OPENAI_MODEL=your-deployment-name                         # NOT the model name (e.g. gpt-4.1-mini)
```

If your tenant doesn't have a GPT-4-family model deployed, request access from your administrator or run the provisioning script.

## Quick Diagnostics

```bash
# Azure OpenAI (strongly preferred). Note the explicit /openai/ in the URL template
# — that's required for raw REST. The VITE_OPENAI_BASE_URL env var itself must NOT
# include /openai (the AzureOpenAI SDK appends it).
source promptions-app/apps/promptions-chat/.env
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST "${VITE_OPENAI_BASE_URL}/openai/deployments/${VITE_OPENAI_MODEL}/chat/completions?api-version=${VITE_OPENAI_API_VERSION}" \
  -H "Content-Type: application/json" \
  -H "api-key: $VITE_OPENAI_API_KEY" \
  -d '{"messages":[{"role":"user","content":"ping"}],"max_tokens":5}'

# Public OpenAI (fallback)
curl -s -o /dev/null -w "%{http_code}\n" https://api.openai.com/v1/models \
  -H "Authorization: Bearer $VITE_OPENAI_API_KEY"
```

`200` means connectivity is good. `401` means the key is wrong. On Azure, `404` means the base URL, deployment name, or API version is wrong (see the Azure rows above).

## Next Steps

- [Quick start](./quick-start.md) — try the hosted ImageGen Workbench demo (zero setup, recommended first-look) or self-host the chatbot
- [Azure OpenAI setup](./azure-openai-setup.md) — provision a GPT-4-family deployment on Azure for the chatbot
- [Application patterns](./application-patterns.md) — integration code and domain workflows
- [Performance guide](./performance-guide.md) — latency, caching, and scaling
- [Schema reference](./reference.md) — complete control type documentation
