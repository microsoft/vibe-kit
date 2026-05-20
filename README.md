# Microsoft Research Vibe Kit

**Microsoft Research Agent Skills** — specialized knowledge, workflows, and demos that teach AI coding assistants how to work with Microsoft Research projects.

## What's Here

This repository hosts **Microsoft Research Agent Skills** — drop-in skills for AI assistants like GitHub Copilot and Claude that teach them how to work with Microsoft Research projects. Each skill includes documentation, working demos, and reference implementations.

## Available Skills

| Skill | Research Area | Description |
|-------|---------------|-------------|
| [Aurora](skills/msresearch-aurora/) | Weather Forecasting | Foundation model for Earth systems — predicts weather, air quality, and ocean waves |
| [MatterGen](skills/msresearch-mattergen/) | Materials Science | Property-conditioned crystal generation for materials discovery |
| [BioEmu](skills/msresearch-bioemu/) | Computational Biology | Protein conformational ensemble generation and dynamics analysis |
| [Dayhoff](skills/msresearch-dayhoff/) | Computational Biology | Protein sequence generation and mutation scoring using hybrid Mamba-Transformer models |
| [Promptions](skills/msresearch-promptions/) | AI/ML Tools | Dynamic control generation and structured prompt middleware for AI copilots |

## Getting Started

Each skill has its own directory with:

- **SKILL.md** — What the skill does and when it activates
- **README.md** — Overview and links to documentation
- **docs/** — Detailed guides, tutorials, and reference material
- **assets/** — Working demos, sample data, and scripts

**Start here:** Pick a skill from the table above and open its directory.

## Installing a Skill

To install a skill for use with your AI assistant:

```bash
npx skills add microsoft/vibe-kit/skills/name-of-skill
```

Replace `name-of-skill` with the skill directory you want to install.

## For AI Assistant Users

These skills are part of **Microsoft Research Agent Skills** — designed to be loaded by AI coding assistants. When you ask your assistant about a topic (e.g., "help me run an Aurora weather forecast"), it loads the relevant skill to get specialized knowledge and workflows.

Skills are defined in `SKILL.md` files with activation conditions that tell the assistant when to use them.

## Links

- [License](LICENSE)
- [Security](SECURITY.md)
- [Microsoft Research](https://www.microsoft.com/research/)
