# Promptions — Microsoft Research Agent Skill

Promptions is a Microsoft Research interaction pattern that turns AI chat history into ephemeral, model-generated UI controls — sliders, toggles, and selectors users can adjust and replay back into the prompt to steer model output without rewriting natural-language instructions.

This skill showcases a hosted ImageGen demo on Microsoft Workbench (the recommended first-look — zero setup) alongside a runnable chatbot reference app (`microsoft/Promptions`) for builders who want to inspect or self-host the code, plus TypeScript modules for the generate → validate → render → replay loop and integration patterns for customer support, content ops, analytics, education, and more.

## Docs

| Doc | Purpose |
|---|---|
| [About Promptions](docs/about-promptions.md) | What Promptions is, how it works, key results, limitations |
| [Quick Start](docs/quick-start.md) | Try the hosted ImageGen demo (zero setup) or self-host the chatbot (Azure OpenAI recommended) in 10 minutes |
| [Azure OpenAI setup](docs/azure-openai-setup.md) | Provision a GPT-4-family deployment on Azure for the self-hosted chatbot (one-shot script + Foundry walkthrough) |
| [Application Patterns](docs/application-patterns.md) | Design playbook, integration code, and domain-specific workflows |
| [Data Integration](docs/data-integration.md) | Transcripts, telemetry, and control persistence |
| [Schema Reference](docs/reference.md) | Complete control type documentation |
| [Performance Guide](docs/performance-guide.md) | Latency, caching, and scaling |
| [Troubleshooting](docs/troubleshooting.md) | Reference-app and integration error fixes |

## Links

- Skill definition: [SKILL.md](./SKILL.md)
- Research paper: [Dynamic Prompt Middleware for Generative AI](https://arxiv.org/abs/2412.02357) (CHIWORK 2025)
- GitHub: https://github.com/microsoft/Promptions
- Microsoft Research project page: https://www.microsoft.com/en-us/research/project/tools-for-thought
- AI Foundry Labs: https://ai.azure.com/explore/foundry-labs

## Install

```bash
npx skills add microsoft/vibe-kit/skills/msresearch-promptions
```
