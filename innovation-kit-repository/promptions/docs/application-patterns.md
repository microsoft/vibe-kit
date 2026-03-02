# Promptions Application Patterns

**Domain-specific workflows and proven use case implementations.**

> Import the canonical helpers from `examples/` rather than redefining them:
> ```typescript
> import { CONTROL_SCHEMA, buildControlPrompt, extractControls } from "../examples/generate-controls";
> import { buildParameterizedPrompt } from "../examples/replay-selections";
> import { validateControls } from "../examples/validate-controls";
> ```

## Customer Support Triage

**Scenario**: Service agents need to tailor responses (tone, escalation path, policy references) without memorizing prompt formulas.

```typescript
import OpenAI from "openai";
import { buildControlPrompt, extractControls } from "../examples/generate-controls";
import { buildParameterizedPrompt } from "../examples/replay-selections";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Step 1: Generate controls for the support scenario
const controlCompletion = await client.chat.completions.create({
    model: "gpt-5-mini",
    temperature: 0.4,
    max_tokens: 800,
    messages: [{
        role: "system",
        content: buildControlPrompt("Customer reports billing issue and wants a supervisor."),
    }],
});

const controls = extractControls(controlCompletion.choices[0]?.message?.content ?? "");
// Expected: escalation urgency slider, empathy tone select, policy reference multi-select

// Step 2: Agent adjusts controls in UI, then generate response
const response = await client.chat.completions.create({
    model: "gpt-5-mini",
    temperature: 0.7,
    messages: [
        { role: "system", content: "You are a customer support agent. Honor the provided selections." },
        { role: "user", content: buildParameterizedPrompt("Customer reports billing issue and wants a supervisor.", controls) },
    ],
});
```

**Real-World Impact**: Consistent triage replies that respect compliance wording while keeping handle time low.

## Marketing Content Briefs

**Scenario**: Creative teams co-design tone, CTA, and audience segments through recomposable controls before finalizing copy.

```typescript
import OpenAI from "openai";
import { buildControlPrompt, extractControls } from "../examples/generate-controls";
import { buildParameterizedPrompt } from "../examples/replay-selections";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Generate controls for marketing email
const controlCompletion = await client.chat.completions.create({
    model: "gpt-5-mini",
    temperature: 0.4,
    messages: [{
        role: "system",
        content: buildControlPrompt("Draft a welcome email for our new analytics product."),
    }],
});

const controls = extractControls(controlCompletion.choices[0]?.message?.content ?? "");
// Expected: tone dropdown, CTA style select, value prop multi-select

// Marketing team adjusts selections in UI
const adjustedControls = controls.map((control) => {
    if (control.label.toLowerCase().includes("tone")) {
        return { ...control, value: "optimistic" };
    }
    if (control.label.toLowerCase().includes("call")) {
        return { ...control, value: "book_demo" };
    }
    return control;
});

// Generate final copy
const response = await client.chat.completions.create({
    model: "gpt-5-mini",
    temperature: 0.7,
    messages: [
        { role: "system", content: "Honor the provided selections and keep responses concise." },
        { role: "user", content: buildParameterizedPrompt("Draft a welcome email for our new analytics product.", adjustedControls) },
    ],
});

console.log(response.choices[0]?.message?.content);
```

**Real-World Impact**: Marketing teams collaborate faster with traceable decisions baked into the transcript.

## Analytics Drilldowns

**Scenario**: Analysts explore dashboards by toggling metrics, cohorts, and comparison windows inside conversational interfaces.

```typescript
import OpenAI from "openai";
import { buildControlPrompt, extractControls } from "../examples/generate-controls";
import { buildParameterizedPrompt } from "../examples/replay-selections";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Generate controls for analytics query
const controlCompletion = await client.chat.completions.create({
    model: "gpt-5-mini",
    temperature: 0.4,
    messages: [{
        role: "system",
        content: buildControlPrompt("Explain Q3 churn drivers."),
    }],
});

const controls = extractControls(controlCompletion.choices[0]?.message?.content ?? "");
// Expected: segment dropdown, lookback window slider, metric granularity select

// Analyst adjusts controls, then generate explanation
const response = await client.chat.completions.create({
    model: "gpt-5-mini",
    temperature: 0.7,
    messages: [
        { role: "system", content: "You are a data analyst. Provide clear explanations with the specified parameters." },
        { role: "user", content: buildParameterizedPrompt("Explain Q3 churn drivers.", controls) },
    ],
});
```

**Real-World Impact**: Non-technical stakeholders can explore data without writing SQL or waiting for analyst cycles.

## Educational Tutoring

**Scenario**: Students select difficulty, focus topics, or feedback style for adaptive explanations.

```typescript
const controls = await generateControls(
    "Explain how photosynthesis works."
);
// Expected: difficulty slider (1-5), focus area multi-select (light reactions, Calvin cycle, etc.), explanation style single-select
```

**Pattern**: Let students control cognitive load by adjusting explanation depth and preferred learning style.

## Healthcare Decision Support

**Scenario**: Clinicians refine symptom context, risk factors, or treatment priorities.

```typescript
const controls = await generateControls(
    "Patient presents with chest pain and shortness of breath."
);
// Expected: risk factor multi-select, urgency slider, differential diagnosis focus dropdown
```

**Pattern**: Controls ensure critical context is captured systematically rather than relying on free-text input that may omit key details.

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
    generateControls(prompt, { temperature: 0.3 }),
    generateControls(prompt, { temperature: 0.5 }),
]);

// Track which variant users prefer
```

### Hybrid Controls

Combine AI-generated controls with predefined options:

```typescript
const aiControls = await generateControls(prompt);
const mandatoryControls: Control[] = [
    { kind: "binary", label: "Include Legal Disclaimer", value: true },
];
const finalControls = [...mandatoryControls, ...aiControls];
```

## Next Steps

- [quick-start.md](./quick-start.md) - Integration tutorial
- [data-integration.md](./data-integration.md) - Transcript and telemetry ingestion
- [performance-guide.md](./performance-guide.md) - Optimization and scaling
- [troubleshooting.md](./troubleshooting.md) - Error diagnosis
