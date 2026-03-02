# Promptions Prototyping Coach

Practical playbook for spinning up a new Promptions-powered experience in an afternoon. This guide helps you focus on dynamic control generation rather than boilerplate.

## 1. Orient the Prototype

1. **Import the canonical modules** from `examples/`:

```typescript
import { CONTROL_SCHEMA, buildControlPrompt, extractControls } from "../examples/generate-controls";
import { validateControls } from "../examples/validate-controls";
import { buildParameterizedPrompt } from "../examples/replay-selections";
import type { Control } from "../examples/control-schema";
```

2. **Set environment defaults** in `.env`:
   - `OPENAI_API_KEY` (required)
   - `OPENAI_MODEL` (optional, defaults to `gpt-5-mini`)
   - `OPENAI_BASE_URL` (optional, for Azure OpenAI)

3. **Spin up a minimal API** using the patterns from [quick-start.md](./quick-start.md).

## 2. Generate Controls on Demand

```typescript
import OpenAI from "openai";
import { buildControlPrompt, extractControls } from "../examples/generate-controls";
import { validateControls } from "../examples/validate-controls";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function getControls(userPrompt: string): Promise<Control[]> {
    const completion = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
        temperature: 0.4,
        max_tokens: 800,
        messages: [{ role: "system", content: buildControlPrompt(userPrompt) }],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const controls = extractControls(raw);

    const validation = validateControls(controls);
    if (!validation.valid) {
        console.error("Validation errors:", validation.errors);
        throw new Error("Invalid controls generated");
    }

    return controls;
}
```

**Tips:**
- Keep temperature ≤0.4 while prototyping; raise only after JSON validation succeeds
- Always validate before rendering controls

## 3. Render Controls & Capture Selections

Use the `ControlRenderer` component from [examples/render-controls.tsx](../examples/render-controls.tsx), or adapt the pattern:

```tsx
import { useState } from "react";
import { ControlRenderer } from "../examples/render-controls";
import type { Control } from "../examples/control-schema";

function ControlPanel({ controls, onUpdate }: { controls: Control[]; onUpdate: (c: Control[]) => void }) {
    const handleChange = (index: number, value: Control["value"]) => {
        const updated = controls.map((ctrl, i) => (i === index ? { ...ctrl, value } : ctrl));
        onUpdate(updated);
    };

    return <ControlRenderer controls={controls} onControlChange={handleChange} />;
}
```

**Key practices:**
- Maintain a single source of truth for control state (indexed array)
- Echo display labels, not raw option keys, when summarizing selections

## 4. Replay Selections

```typescript
import OpenAI from "openai";
import { buildParameterizedPrompt } from "../examples/replay-selections";

export async function generateWithControls(basePrompt: string, controls: Control[]): Promise<string> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
        temperature: 0.7,
        max_tokens: 1200,
        messages: [
            { role: "system", content: "You are a helpful assistant. Follow the user prompt and apply all specified parameters." },
            { role: "user", content: buildParameterizedPrompt(basePrompt, controls) },
        ],
    });

    return completion.choices[0]?.message?.content ?? "";
}
```

## 5. Complete Flow Example

```typescript
// 1. User enters prompt
const userPrompt = "Write a product announcement for our new AI feature";

// 2. Generate controls
const controls = await getControls(userPrompt);

// 3. User adjusts controls in UI (simulated here)
controls[0].value = "professional"; // Adjust tone

// 4. Generate final output with selections
const output = await generateWithControls(userPrompt, controls);
console.log(output);
```

## 6. Prototype Checklist

- [ ] Environment variables configured (`.env`)
- [ ] API route for `/api/generate-controls`
- [ ] API route for `/api/generate`
- [ ] UI component rendering all 6 control types
- [ ] Control state management (indexed array)
- [ ] Validation before rendering
- [ ] Error handling for LLM failures

## Quick Reference

| Task | File |
|------|------|
| Type definitions | [examples/control-schema.ts](../examples/control-schema.ts) |
| Control generation | [examples/generate-controls.ts](../examples/generate-controls.ts) |
| Validation | [examples/validate-controls.ts](../examples/validate-controls.ts) |
| Selection replay | [examples/replay-selections.ts](../examples/replay-selections.ts) |
| UI component | [examples/render-controls.tsx](../examples/render-controls.tsx) |

## Next Steps

- [application-patterns.md](./application-patterns.md) - Domain-specific workflows
- [performance-guide.md](./performance-guide.md) - Optimization
- [troubleshooting.md](./troubleshooting.md) - Error diagnosis
