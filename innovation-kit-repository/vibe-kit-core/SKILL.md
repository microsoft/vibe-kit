---
name: vibe-kit-core
description: Shared cross-cutting guidance for working with Vibe Kit.
license: MIT
---
## Activation Conditions

Activate when users request general Vibe Kit help, cross-kit workflows, installation guidance, or migration support that is not specific to a single domain kit.

## Scope Boundaries

- Provide shared conventions that apply across all innovation kits.
- Route domain-specific questions to the relevant kit skill.
- Keep guidance action-oriented and aligned with existing docs and CLI behavior.

## Core Guidance

- Never expose credentials or secrets in generated outputs.
- Keep rapid-prototyping workflows reproducible and explicitly validated.

## Installed Doc Index

Read these files from their installed location:

- `.vibe-kit/skills/vibe-kit-core/docs/api-design.md` — FastAPI backend API design and response patterns; read when creating or editing Python backend endpoints.
- `.vibe-kit/skills/vibe-kit-core/docs/design.md` — Frontend UX and accessibility guidance; read when designing or implementing `tsx` and `css` UI changes.
- `.vibe-kit/skills/vibe-kit-core/docs/markdown.md` — Markdown authoring rules for agent-friendly docs; read when creating or updating markdown files.


## MCP-assisted context

- **Sequential-thinking MCP Server**: When facing multi-step tasks, draft a brief plan using `sequential-thinking` MCP tools; keep steps short and verifiable.
- **Memory MCP Server**: Persist only safe, high-level observations (e.g., decisions, assumptions, file paths) under a project entity like "vibe_kit". Never store credentials or personal data.
- **Context7 MCP Server** Library Docs: Fetch authoritative library/framework documentation. Always resolve the exact library ID first, then retrieve only the focused topic and minimal tokens needed. See `.vibe-kit/instructions/library-docs-context7.instructions.md`.

### Using Context7 Library Docs MCP Server

#### When to use Context7

- You need exact API signatures, configuration options, or version-specific behavior from a known library.
- You’re unsure about a framework feature and want canonical docs instead of guessing.
- You’re implementing or debugging behavior tied to a specific library version.

#### Context7 Golden rules

- Always resolve the library ID first.
	- Use the resolver to find the exact Context7-compatible ID (e.g., `/vercel/next.js`, `/vercel/next.js/v14.3.0-canary.87`).
	- If the user gives an explicit ID in `/org/project` or `/org/project/version` format, use it directly.
- Fetch minimally scoped docs.
	- Pass a focused topic (e.g., `routing`, `middleware`, `hooks`, `configuration`).
	- Limit tokens to what’s needed to answer the question—prefer small snippets over full pages.
- Cite source succinctly.
	- Mention the library ID and topic you queried so future steps can reproduce the lookup.
- Prefer docs over memory.
	- If in doubt, check the docs; don’t rely on stale priors.
- If no good match is found by the resolver, proceed with a best-guess and note it.

#### Context7 Workflow

1. Clarify target library and version (from codebase manifests or user prompt). If ambiguous, pick the most likely version based on lockfiles; note the assumption.
2. Resolve the Context7 library ID.
3. Retrieve only the relevant topic with a modest token budget.
4. Apply findings to the task (implement, fix, or document) and keep the quoted content under ~200 lines.
5. If behavior is version-sensitive, record the version and a brief note in the task summary.

#### Context7 Quality gates

- Verify that retrieved docs align with the project’s actual dependency versions when possible.
- Avoid over-fetching; keep context tight and reproducible.
- Don’t paste large doc dumps; summarize with short quotes as needed.

#### Context7 Examples (concise)

- Need Next.js middleware matching: Resolve `/vercel/next.js` → fetch topic `middleware` → implement edge case per docs.
- Unsure about Prisma relation modes: Resolve `/prisma/prisma` → topic `relation-mode` → update schema accordingly.


## Response Style

- Use some bold, italics, `preformatted text`, and headers for emphasis and visual interest, but sparingly.
- Use bullet and numbered lists as appropriate for clarity.
- Start with the answer or action first; avoid long intros or apologies.
- Open with a one-line task receipt and a compact checklist of requirements.
- Use level 2 and 3 headings with short bullets; keep it skimmable and concrete.
- Provide progress updates after batches of work (3–5 tool calls or >3 files edited). Report only deltas since the last update.
- Quote sparingly: avoid heavy dumps; keep quoted code under ~200 lines unless explicitly requested. Prefer patch-based edits.
- When using Context7 docs, cite the library ID and topic briefly (e.g., "Source: /vercel/next.js, topic: middleware").
- Use fenced blocks for commands, one per line; run commands yourself when possible and summarize results.
- Keep answers short by default; add detail only when the task requires it.
- Maintain a friendly, confident tone; avoid filler. A touch of personality is okay.
- When blocked, state the minimal missing detail and offer 1–2 viable defaults to proceed.

## Workflow

1. Identify whether the request is cross-cutting or domain-specific.
2. If cross-cutting, apply shared install, migration, and compatibility rules.
3. If domain-specific, route to the matching domain `SKILL.md` in the kit root.
4. Validate changes with focused checks before updating task status.

## Domain Skill Routing

- See installed skills for details
