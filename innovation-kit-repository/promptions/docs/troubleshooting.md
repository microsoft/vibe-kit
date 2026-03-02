# Promptions Troubleshooting

## Common Issues

| Issue                   | Solution                                                                |
| ----------------------- | ----------------------------------------------------------------------- |
| 401 Unauthorized        | Check `OPENAI_API_KEY` in `.env`                                        |
| Invalid JSON from LLM   | Lower temperature to 0.3, ensure CONTROL_SCHEMA is in the system prompt |
| 429 Rate Limited        | Add retry with exponential backoff                                      |
| Schema validation fails | Use `validateControls()` before rendering                               |
| Controls not rendering  | Verify control array is not empty and all required fields are present   |
| Options field missing   | For select/dropdown controls, ensure `options` object exists            |
| Permission denied: vite | Yarn 4 hoists deps to root; use `npx vite` from the app directory instead of `corepack yarn workspace ... dev` |
| App won't load in browser | Vite v7 binds to IPv6 `::1` by default; add `--host 0.0.0.0` to bind to all interfaces for dev container port forwarding |

## Quick Diagnostics

```bash
# Check environment configuration
cat .env

# Validate connectivity to OpenAI
curl -s -o /dev/null -w "%{http_code}\n" https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Test Azure OpenAI endpoint
curl -s -o /dev/null -w "%{http_code}\n" "$OPENAI_BASE_URL/deployments?api-version=2024-02-15" \
  -H "api-key: $OPENAI_API_KEY"
```

## Validation Debugging

```typescript
import { validateControls } from "../examples/validate-controls";

const result = validateControls(controls);
if (!result.valid) {
    console.error("Validation errors:");
    result.errors.forEach((error) => console.error(`  - ${error}`));
}
```

## JSON Extraction Issues

If the LLM returns malformed JSON:

1. **Lower temperature** to 0.3 during control generation
2. **Check the raw response** before parsing:
   ```typescript
   const raw = completion.choices[0]?.message?.content ?? "";
   console.log("Raw LLM response:", raw);
   ```
3. **Ensure the schema is included** in the system prompt
4. **Use the extraction helper** which handles code fences:
   ```typescript
   import { extractControls } from "../examples/generate-controls";
   const controls = extractControls(raw);
   ```

## Azure OpenAI Configuration

For Azure OpenAI, ensure these environment variables are set:

```bash
OPENAI_BASE_URL=https://your-resource.openai.azure.com/openai
OPENAI_API_KEY=your-azure-api-key
OPENAI_MODEL=your-deployment-name
OPENAI_API_VERSION=2024-02-15
```

## Common Fixes

- **Dependencies**: `npm install openai @azure/openai dotenv`
- **Azure permissions**: Confirm deployment access in Azure AI Foundry
- **Model availability**: Request GPT-5 model family from your tenant administrator if needed

## Next Steps

- [quick-start.md](./quick-start.md) - Integration tutorial
- [performance-guide.md](./performance-guide.md) - Optimization guidance
