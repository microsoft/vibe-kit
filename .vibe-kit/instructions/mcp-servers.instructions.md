---
description: Best practices for managing MCP Servers and tools
applyTo: "**/*"
---

## MCP-assisted context

- **Sequential-thinking MCP Server**: When facing multi-step tasks, draft a brief plan using `sequential-thinking` MCP tools; keep steps short and verifiable.
- **Memory MCP Server**: Persist only safe, high-level observations (e.g., decisions, assumptions, file paths) under a project entity like "vibe_kit". Never store credentials or personal data.
- **Context7 MCP Server** Library Docs: Fetch authoritative library/framework documentation. Always resolve the exact library ID first, then retrieve only the focused topic and minimal tokens needed. See `.vibe-kit/instructions/library-docs-context7.instructions.md`.

### Using Context 7 Library Docs MCP Server

## When to use

- You need exact API signatures, configuration options, or version-specific behavior from a known library.
- You’re unsure about a framework feature and want canonical docs instead of guessing.
- You’re implementing or debugging behavior tied to a specific library version.

## Golden rules

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

## Workflow

1. Clarify target library and version (from codebase manifests or user prompt). If ambiguous, pick the most likely version based on lockfiles; note the assumption.
2. Resolve the Context7 library ID.
3. Retrieve only the relevant topic with a modest token budget.
4. Apply findings to the task (implement, fix, or document) and keep the quoted content under ~200 lines.
5. If behavior is version-sensitive, record the version and a brief note in the task summary.

## Quality gates

- Verify that retrieved docs align with the project’s actual dependency versions when possible.
- Avoid over-fetching; keep context tight and reproducible.
- Don’t paste large doc dumps; summarize with short quotes as needed.

## Examples (concise)

- Need Next.js middleware matching: Resolve `/vercel/next.js` → fetch topic `middleware` → implement edge case per docs.
- Unsure about Prisma relation modes: Resolve `/prisma/prisma` → topic `relation-mode` → update schema accordingly.

## Notes

- Do not exfiltrate secrets or make external calls except via the MCP interface as part of the task.
- If no good match is found by the resolver, proceed with a best-guess and note it.
