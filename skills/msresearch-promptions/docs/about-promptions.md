# What is Promptions?

**Promptions is a Microsoft Research interaction pattern that turns AI chat history into ephemeral, model-generated UI controls — sliders, toggles, and selectors that users can adjust and replay back into the prompt to steer the model's response without rewriting natural-language instructions.**

> Already familiar with Promptions and want to run the demo? Skip ahead to [quick-start.md](./quick-start.md), or jump straight to [application-patterns.md](./application-patterns.md) for integration code.

---

## Contents

- [The Problem Promptions Solves](#the-problem-promptions-solves)
- [What Promptions Does](#what-promptions-does)
- [How It Works](#how-it-works)
- [Key Results](#key-results)
- [Real-World Applications](#real-world-applications)
- [Limitations](#limitations)
- [Learn More](#learn-more)

---

## The Problem Promptions Solves

Most generative-AI interfaces give users one knob: free-text prompting. To change tone, length, audience, format, or constraints, the user has to rewrite the prompt — over and over. This forces users to either:

- **Memorize prompt-engineering recipes** that don't transfer between models or domains
- **Copy/paste long persona blocks** every time they want a small adjustment
- **Accept whatever the model returns** because reformulating feels harder than living with the answer

The result is a brittle steering surface. Users can't decompose what they want, can't compare alternatives cheaply, and can't see *why* changing one phrase changed the output.

## What Promptions Does

Promptions inserts a middleware layer between the user prompt and the final completion:

1. **Reads the user's prompt** (and optionally chat history).
2. **Asks the model to propose a small set of UI controls** that meaningfully parameterize the response — tone sliders, audience selectors, format toggles, length ranges, etc.
3. **Renders those controls** in the host app (React + Fluent UI v9 in the bundled reference apps).
4. **Lets the user adjust them** and previews how each adjustment will reshape the response.
5. **Replays the selections** as structured parameters appended to the original prompt and requests the final completion.

The controls are *ephemeral* — they're regenerated for each new prompt — and *grounded in the prompt itself*, so the steering surface always matches the task at hand.

## How It Works

```
user prompt
    │
    ▼
buildControlPrompt() ──▶ LLM (low temperature) ──▶ raw JSON
                                                      │
                                                      ▼
                                              extractControls()
                                                      │
                                                      ▼
                                              validateControls()
                                                      │
                                                      ▼
                                              UI rendering ◀── user adjusts
                                                      │
                                                      ▼
                                       buildParameterizedPrompt()
                                                      │
                                                      ▼
                                              LLM (normal temperature)
                                                      │
                                                      ▼
                                              final response
```

Six control kinds cover the steering surface: `slider`, `single-select`, `dropdown`, `multi-select`, `text-input`, `binary`. Full schema in [reference.md](./reference.md).

## Key Results

- **Interactive latency:** ~1.6 s average control generation on `gpt-5`, vs. ~3.8 s for manual prompt rewrites (internal Promptions load tests, Oct 2025).
- **Streaming responsiveness:** first token under 300 ms with SSE streaming on `gpt-5-mini`.
- **Adoption:** +22% successful task completion using Dynamic Prompt Middleware compared to static control panels (CHIWORK 2025 study).

## Real-World Applications

- **Customer support triage** — agents adjust escalation urgency, empathy tone, and policy citations without rewriting templates.
- **Content operations** — marketers tune tone, CTA style, and audience segments through controls instead of brief revisions.
- **Analytics drilldowns** — analysts toggle cohorts, lookback windows, and metric granularities inside conversational dashboards.
- **Educational tutoring** — students set difficulty, focus topics, and explanation style for adaptive lessons.
- **Image generation** — same pattern applied to MAI_Image-2: generate controls for style, palette, composition, then re-roll.

See [application-patterns.md](./application-patterns.md) for runnable code in each scenario.

## Limitations

- **Relies on external LLM availability.** OpenAI or Azure OpenAI is required; latency and cost track the hosted model.
- **JSON fidelity is the failure mode.** Controls must round-trip through JSON; malformed model output is the most common bug. Always validate before rendering.
- **UI framework coupling.** The bundled renderer targets React + Fluent UI v9. Vue/Svelte/vanilla integrations work but require porting the renderer.
- **Ephemeral by design.** Controls don't persist across turns by default. Persisting them is straightforward (see [application-patterns.md](./application-patterns.md#session-persistence)) but is the integrator's responsibility.
- **Not a replacement for prompt engineering.** Promptions complements a well-written base prompt; it doesn't rescue a bad one.

## Learn More

- **Research paper:** [Dynamic Prompt Middleware for Generative AI](https://arxiv.org/abs/2412.02357) (CHIWORK 2025) — also bundled at [`assets/papers/promptions.pdf`](../assets/papers/promptions.pdf).
- **GitHub:** [github.com/microsoft/Promptions](https://github.com/microsoft/Promptions)
- **Microsoft Research project page:** [Tools for Thought](https://www.microsoft.com/en-us/research/project/tools-for-thought)
- **AI Foundry Labs:** [ai.azure.com/explore/foundry-labs](https://ai.azure.com/explore/foundry-labs)

## Next Steps

- [Quick start](./quick-start.md) — try the hosted ImageGen Workbench demo (zero setup, recommended first-look) or self-host the chatbot
- [Application patterns](./application-patterns.md) — domain workflows and integration code
- [Schema reference](./reference.md) — complete control type documentation
