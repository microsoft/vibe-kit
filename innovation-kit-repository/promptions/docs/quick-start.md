# Promptions Quick Start

Get Promptions working in your stack using the canonical control-generation and replay patterns. This guide covers API integration patterns and UI rendering.

## Prerequisites

- Node.js 18+ or equivalent runtime
- OpenAI API key (or Azure OpenAI deployment)
- React 18+ with Fluent UI v9 (for UI examples)

## Reference Applications

Promptions includes two full reference applications in the public repository. The install flow clones them to
`promptions-app/` under the kit root.

| App | Port | Description |
|-----|------|-------------|
| `promptions-chat` | 3003 | Interactive chat where controls are generated, adjusted, and replayed into responses |
| `promptions-image` | 3004 | Image generation workflow using the same control-generation and replay pattern |

To run either app reliably in local or containerized development, start Vite from the app directory using
`npx vite --host 0.0.0.0 --port <port>`.

## 1. Configure Credentials

Copy the template and fill in your secrets:

```bash
cd .vibe-kit/innovation-kits/promptions
cp .env.example .env
```

Then edit `.env` to provide your credentials:

- `OPENAI_API_KEY`: required; use a disposable key during prototyping
- `OPENAI_MODEL`: defaults to `gpt-5-mini`; swap to your Azure deployment name if using Azure
- `OPENAI_BASE_URL`: only for Azure OpenAI (`https://<resource-name>.openai.azure.com/openai`)
- `OPENAI_API_VERSION`: only for Azure OpenAI (e.g., `2024-02-15`)

## 2. Generate Control Schemas

Import the canonical modules from `examples/`:

```typescript
import { buildControlPrompt, extractControls } from "../examples/generate-controls";
import { validateControls } from "../examples/validate-controls";
```

Create an API route that generates controls:

```typescript
import OpenAI from "openai";
import { buildControlPrompt, extractControls } from "../examples/generate-controls";
import { validateControls } from "../examples/validate-controls";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.OPENAI_MODEL || "gpt-5-mini";

app.post("/api/generate-controls", async (req, res) => {
    const { userPrompt } = req.body;

    try {
        const completion = await client.chat.completions.create({
            model,
            temperature: 0.4,
            max_tokens: 800,
            messages: [{ role: "system", content: buildControlPrompt(userPrompt) }],
        });

        const response = completion.choices[0]?.message?.content ?? "";
        const controls = extractControls(response);

        const validation = validateControls(controls);
        if (!validation.valid) {
            return res.status(400).json({ errors: validation.errors });
        }

        res.json({ controls });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

**Best practices:**
- Keep `temperature` low (0.3-0.4) to maximize JSON fidelity
- Always validate before returning to clients
- Track latency and token usage for experimentation metrics

## 3. Replay Selections into a Completion

When users tweak controls, serialize the values back into the prompt:

```typescript
import { buildParameterizedPrompt } from "../examples/replay-selections";

app.post("/api/generate", async (req, res) => {
    const { basePrompt, controls } = req.body;

    try {
        const startTime = Date.now();
        const completion = await client.chat.completions.create({
            model,
            temperature: 0.7,
            max_tokens: 1200,
            messages: [
                { role: "system", content: "You are a helpful assistant. Follow the user prompt and apply all specified parameters." },
                { role: "user", content: buildParameterizedPrompt(basePrompt, controls) },
            ],
        });

        res.json({
            output: completion.choices[0]?.message?.content ?? "",
            tokens: completion.usage?.total_tokens ?? 0,
            latency: Date.now() - startTime,
            model,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

**Best practices:**
- Place "Apply these parameters" block as a user message
- Keep the system role focused on enforcing parameter adherence

## 4. Render Controls in Your UI

Use the `ControlRenderer` component from `examples/render-controls.tsx`, or adapt the pattern to your framework:

```tsx
import { useState } from "react";
import { ControlRenderer } from "../examples/render-controls";
import type { Control } from "../examples/control-schema";

function PromptionsDemoPanel() {
    const [controls, setControls] = useState<Control[]>([]);

    const handleControlChange = (index: number, value: Control["value"]) => {
        setControls((prev) =>
            prev.map((ctrl, i) => (i === index ? { ...ctrl, value } : ctrl))
        );
    };

    return (
        <div>
            <ControlRenderer
                controls={controls}
                onControlChange={handleControlChange}
            />
            <button onClick={() => submitWithControls(controls)}>
                Generate Response
            </button>
        </div>
    );
}
```

**Key practices:**
- Keep control state in an indexed array so you can round-trip the payload to the API
- Convert option keys to human-friendly labels before displaying
- Display feedback (latency, tokens) from `/api/generate` to reinforce experimentation

## 5. Complete Example

See the files in `examples/` for the complete implementation:

| File | Purpose |
|------|---------|
| [control-schema.ts](../examples/control-schema.ts) | Type definitions and `CONTROL_SCHEMA` string |
| [generate-controls.ts](../examples/generate-controls.ts) | `buildControlPrompt()`, `extractControls()` |
| [validate-controls.ts](../examples/validate-controls.ts) | `validateControls()`, `validateControl()` |
| [replay-selections.ts](../examples/replay-selections.ts) | `buildParameterizedPrompt()` |
| [render-controls.tsx](../examples/render-controls.tsx) | React/Fluent UI component |

## Adapting to Other Frameworks

The control schema and middleware pattern are framework-agnostic. Only `render-controls.tsx` is React-specific.

- Vue: Map controls with `v-for` into your component library equivalents.
- Svelte: Render controls with `{#each}` and bind selected values into a shared store.
- Vanilla JavaScript: Render controls directly to DOM and serialize selections into the replay payload.
- Adaptive Cards: Transform control objects into Adaptive Card input elements before replay.

## Next Steps

- **Real data**: [data-integration.md](./data-integration.md) - Connect chat transcripts and UI telemetry
- **Patterns**: [application-patterns.md](./application-patterns.md) - Domain-specific workflows
- **Issues**: [troubleshooting.md](./troubleshooting.md) - Error diagnosis guide
- **Performance**: [performance-guide.md](./performance-guide.md) - Optimization and scaling

## Quick Fixes

- **Missing OPENAI_API_KEY**: Create `.env` at the kit root (see Step 1) before calling the API
- **Invalid JSON output**: Drop `temperature` to `0.3`, prepend the full schema, log raw model response
- **Proxy errors**: Bubble up the OpenAI status code and body so operators can diagnose rate limits or auth failures
