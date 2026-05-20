# Performance Guide

Latency, caching, hardware, and scaling guidance for Promptions deployments.

## Performance Metrics

**Interactive latency**: 1.6 s average option generation on `gpt-5` vs 3.8 s manual prompt rewrites. (source: internal Promptions load tests, Oct 2025)
**Streaming responsiveness**: First token <300 ms when using SSE streaming with `gpt-5-mini`. (source: local benchmarking)
**Adoption KPI**: +22% successful task completion in Dynamic Prompt Middleware compared to static controls. (source: CHIWORK 2025 study)

## Hardware Requirements

| Use Case   | CPU           | RAM  | GPU | Cost/Hour |
| ---------- | ------------- | ---- | --- | --------- |
| Dev        | 4 vCPU VM     | 8GB  | N/A | ~$0.09    |
| Production | 8 vCPU AppSvc | 16GB | N/A | ~$0.18    |

## Optimization

```javascript
// Memory optimization: reuse OpenAI client and schema string
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const schemaPrompt = fs.readFileSync("./schema/basic-options.txt", "utf8");
```

```typescript
// Speed optimization: stream partial JSON and debounce rendering
for await (const chunk of stream) {
  buffer += chunk.choices[0]?.delta?.content ?? "";
  if (buffer.includes("}") && Date.now() - lastRender > 120) {
    renderPartial(buffer);
    lastRender = Date.now();
  }
}
```

```python
# Batch processing: asynchronous option generation for multiple chats
import asyncio
from promptions_runner import generate_options

async def batch(chats):
    tasks = [asyncio.create_task(generate_options(chat)) for chat in chats]
    return await asyncio.gather(*tasks)

results = asyncio.run(batch(chat_histories))
```

## Scaling

**Horizontal**: Deploy stateless option services behind Azure Container Apps with autoscale on latency p95.  
**Vertical**: Move to `gpt-5` for high fidelity, fall back to `gpt-5-mini` for bulk exploration.  
**Caching**: Persist option payloads keyed by `(prompt_hash, persona)` to avoid regenerating identical control sets.

## Next Steps

- [Quick start](./quick-start.md) — launch the bundled chatbot or image generator
- [Application patterns](./application-patterns.md) — integration code and domain workflows
- [Troubleshooting](./troubleshooting.md) — error fixes and diagnostics