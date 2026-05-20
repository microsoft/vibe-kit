# Application Patterns

Integration code and domain-specific workflows for Promptions. Use this doc to wire Promptions into your own app and to see how the same pattern adapts across domains.

## Design First

Before writing integration code, scope the experience.

### Orient the Prototype

Answer three questions before generating any controls:

1. **What is the user trying to steer?** Tone? Audience? Length? Format? Domain-specific knobs (urgency, cohort, difficulty)? Promptions shines when there are 3–6 meaningful axes per prompt.
2. **What's the base prompt?** Every Promptions session starts from a user-authored prompt. Make sure your app captures one cleanly before generating controls.
3. **Where does state live?** Controls are ephemeral by default — decide up front whether you'll persist them per-session, per-user, or not at all.

Then set up the environment:

- Configure the per-app `.env` (`apps/promptions-chat/.env`): `VITE_OPENAI_API_KEY` required; `VITE_OPENAI_MODEL` defaults to `gpt-4.1` for public OpenAI or the Azure deployment name on Azure; `VITE_OPENAI_BASE_URL` and `VITE_OPENAI_API_VERSION` only for Azure (and `VITE_OPENAI_BASE_URL` must NOT include the `/openai` suffix). See [quick-start.md](./quick-start.md) for the full procedure.
- Pick the closest scenario in [Domain Patterns](#domain-patterns) and adapt the helpers below.

### Design the Control Surface

Six control kinds cover most steering needs (full schema in [reference.md](./reference.md)):

| Steering need                | Control kind    | Tip                                                               |
| ---------------------------- | --------------- | ----------------------------------------------------------------- |
| Numeric range (e.g. length)  | `slider`        | Use sensible `min`/`max`/`step`; avoid 0–1 floats                 |
| 2–4 categorical choices      | `single-select` | Radio-style; great for tone, format                               |
| 5+ categorical choices       | `dropdown`      | Compact; great for languages, regions                             |
| Multiple from a set          | `multi-select`  | Default to a sensible subset, not empty                           |
| Free-form value              | `text-input`    | Use sparingly; defeats the "no typing" benefit                    |
| Yes/no                       | `binary`        | Great for include/exclude flags                                   |

**Rules of thumb:**

- 3–6 controls per session. More overwhelms users; fewer wastes the pattern.
- Prefer `single-select` and `multi-select` over `text-input` — typing is what Promptions exists to reduce.
- Echo display labels (not raw option keys) when summarizing selections.

### Prototype Checklist

Before sharing the prototype:

- [ ] `.env` configured and validated (`curl` check from [quick-start.md](./quick-start.md))
- [ ] API route for generating controls (`/api/generate-controls`)
- [ ] API route for replaying selections (`/api/generate`)
- [ ] UI component rendering all relevant control kinds
- [ ] Control state held in a single indexed array (round-trips cleanly to the API)
- [ ] Validation runs before rendering — never trust raw model output
- [ ] Error handling for LLM failures (401, 429, malformed JSON)
- [ ] Latency and token usage surfaced in the UI for experimentation
- [ ] Display labels (not option keys) shown to users

### Iterate

Once a base prototype works:

- **Lower friction first.** Make adjustment cheap before adding more control kinds.
- **A/B test control variants.** Generate two control sets for the same prompt and measure preference (see [A/B Testing Control Variants](#ab-testing-control-variants)).
- **Layer in mandatory controls.** Compliance toggles, audience flags, brand tone — combine AI-generated controls with predefined ones (see [Hybrid Controls](#hybrid-controls)).
- **Watch latency.** Aim for first control under 2 s; stream if you're hitting 3 s+ (see [performance-guide.md](./performance-guide.md)).

---

## Wire It Up

The four canonical operations — generate controls, validate, render, replay — are bundled as TypeScript modules in [`lib/`](../lib/). Import them rather than rewriting the helpers:

```typescript
import OpenAI from "openai";
import { buildControlPrompt, extractControls } from "../lib/generate-controls";
import { validateControls } from "../lib/validate-controls";
import { buildParameterizedPrompt } from "../lib/replay-selections";
import type { Control } from "../lib/control-schema";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
```

### A reusable `generateControls` helper

Every workflow below uses this wrapper. Define it once in your project:

```typescript
async function generateControls(userPrompt: string): Promise<Control[]> {
    const completion = await client.chat.completions.create({
        model,
        temperature: 0.4,
        max_tokens: 800,
        messages: [{ role: "system", content: buildControlPrompt(userPrompt) }],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const controls = extractControls(raw);

    const validation = validateControls(controls);
    if (!validation.valid) {
        throw new Error(`Invalid controls: ${validation.errors.join(", ")}`);
    }
    return controls;
}
```

**Why these defaults?**

- `temperature: 0.4` keeps JSON output well-formed without making controls feel rigid.
- `max_tokens: 800` is enough for 3–6 controls; raise only if you see truncation.
- Validation always runs before returning — malformed JSON is the most common failure mode.

### A reusable `generateWithControls` helper

```typescript
async function generateWithControls(basePrompt: string, controls: Control[]): Promise<string> {
    const completion = await client.chat.completions.create({
        model,
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

**Why a user-role parameter block?**

- Keeps the system role focused on persona and behavior.
- Makes the parameterization auditable in the transcript.

### Render in React

```tsx
import { useState } from "react";
import { ControlRenderer } from "../lib/render-controls";
import type { Control } from "../lib/control-schema";

function PromptionsPanel({ basePrompt }: { basePrompt: string }) {
    const [controls, setControls] = useState<Control[]>([]);
    const [output, setOutput] = useState("");

    const handleChange = (index: number, value: Control["value"]) => {
        setControls((prev) => prev.map((c, i) => (i === index ? { ...c, value } : c)));
    };

    return (
        <>
            <ControlRenderer controls={controls} onControlChange={handleChange} />
            <button onClick={async () => setOutput(await generateWithControls(basePrompt, controls))}>
                Generate
            </button>
            <pre>{output}</pre>
        </>
    );
}
```

For non-React stacks, `ControlRenderer` is the only React-specific module — see [Adapting to other frameworks](#adapting-to-other-frameworks).

---

## Domain Patterns

Each pattern uses the `generateControls` / `generateWithControls` helpers defined above.

### Customer Support Triage

**Scenario:** Service agents need to tailor responses (tone, escalation path, policy references) without memorizing prompt formulas.

```typescript
const basePrompt = "Customer reports billing issue and wants a supervisor.";
const controls = await generateControls(basePrompt);
// Expected: escalation urgency slider, empathy tone select, policy reference multi-select

// Agent adjusts controls in UI, then:
const reply = await generateWithControls(basePrompt, controls);
```

**Real-world impact:** consistent triage replies that respect compliance wording while keeping handle time low.

### Marketing Content Briefs

**Scenario:** Creative teams co-design tone, CTA, and audience segments through recomposable controls before finalizing copy.

```typescript
const basePrompt = "Draft a welcome email for our new analytics product.";
const controls = await generateControls(basePrompt);
// Expected: tone dropdown, CTA style select, value-prop multi-select

// Marketing team adjusts selections in UI; for example:
const adjusted = controls.map((c) => {
    if (c.label.toLowerCase().includes("tone")) return { ...c, value: "optimistic" };
    if (c.label.toLowerCase().includes("call")) return { ...c, value: "book_demo" };
    return c;
});

const copy = await generateWithControls(basePrompt, adjusted);
```

**Real-world impact:** marketing teams collaborate faster with traceable decisions baked into the transcript.

### Analytics Drilldowns

**Scenario:** Analysts explore dashboards by toggling metrics, cohorts, and comparison windows inside conversational interfaces.

```typescript
const basePrompt = "Explain Q3 churn drivers.";
const controls = await generateControls(basePrompt);
// Expected: segment dropdown, lookback window slider, metric granularity select

const explanation = await generateWithControls(basePrompt, controls);
```

**Real-world impact:** non-technical stakeholders can explore data without writing SQL or waiting for analyst cycles.

### Educational Tutoring

**Scenario:** Students select difficulty, focus topics, or feedback style for adaptive explanations.

```typescript
const basePrompt = "Explain how photosynthesis works.";
const controls = await generateControls(basePrompt);
// Expected: difficulty slider (1-5), focus area multi-select (light reactions, Calvin cycle, etc.),
// explanation style single-select

const lesson = await generateWithControls(basePrompt, controls);
```

**Pattern:** let students control cognitive load by adjusting explanation depth and preferred learning style.

### Healthcare Decision Support

**Scenario:** Clinicians refine symptom context, risk factors, or treatment priorities. Use only as decision *support*, not autonomous diagnosis.

```typescript
const basePrompt = "Patient presents with chest pain and shortness of breath.";
const controls = await generateControls(basePrompt);
// Expected: risk factor multi-select, urgency slider, differential diagnosis focus dropdown

const summary = await generateWithControls(basePrompt, controls);
```

**Pattern:** controls ensure critical context is captured systematically rather than relying on free-text input that may omit key details.

---

## Common Patterns

### Session Persistence

Store control state alongside conversation history to enable resume and audit:

```typescript
interface PromptionsSession {
    sessionId: string;
    basePrompt: string;
    controls: Control[];
    history: Array<{ role: string; content: string }>;
    createdAt: Date;
    updatedAt: Date;
}
```

### A/B Testing Control Variants

Generate multiple control sets and measure which configurations lead to better outcomes:

```typescript
const variants = await Promise.all([
    generateControls(basePrompt),
    generateControls(basePrompt), // re-roll for natural variation
]);
// Track which variant users prefer.
```

### Hybrid Controls

Combine AI-generated controls with predefined options. See [reference.md](./reference.md) for all control kinds.

```typescript
import type { Control } from "../lib/control-schema";

const aiControls = await generateControls(basePrompt);
const mandatoryControls: Control[] = [
    { kind: "binary", label: "Include Legal Disclaimer", value: true },
];
const finalControls = [...mandatoryControls, ...aiControls];
```

---

## Adapting to Other Frameworks

The control schema and middleware are framework-agnostic. Only `render-controls.tsx` is React-specific.

- **Vue:** map controls with `v-for` into your component-library equivalents.
- **Svelte:** render controls with `{#each}` and bind selected values into a shared store.
- **Vanilla JavaScript:** render controls directly to DOM and serialize selections into the replay payload.
- **Adaptive Cards:** transform control objects into Adaptive Card input elements before replay.

The schema → renderer mapping in [reference.md](./reference.md#ui-component-mapping) gives the per-kind component for Fluent UI v9 and raw HTML.

## Next Steps

- [Quick start](./quick-start.md) — try the hosted ImageGen Workbench demo (zero setup, recommended first-look) or self-host the chatbot
- [Data integration](./data-integration.md) — transcripts, telemetry, and control persistence
- [Schema reference](./reference.md) — complete control type documentation
- [Performance guide](./performance-guide.md) — latency, caching, and scaling
- [Troubleshooting](./troubleshooting.md) — error fixes and diagnostics
