Compose context by including only the modules needed for the current task. Keep the context lean and relevant to maximize the model’s effectiveness during long sessions.

# General guidelines
- Always check your indentation. Match the file's indentation style and the insertion point's correct indentation level.
- Prefer code that is readable more than clever.
- Ensure that all code would pass Ruff linting and syntax checks for Python code and Prettier for all other code.

# Context Engineering guidelines
- If details are missing, infer 1–2 reasonable assumptions and proceed; ask only if blocked.
- User/task-specific directives override custom instructions within the current request.
- When conflicting guidance appears, prefer the most specific, most recent instruction.
- For long sessions, prefer module references and patch-based edits instead of quoting large files; keep any quoted content under ~200 lines unless the user explicitly requests full dumps.

# Innovation Kits

This repo contains innovation kit skills in two locations:

- `skills/` — Source skill definitions. Edit these when developing or modifying skills.
- `.agents/skills/` — Installed/active skills. These are copied from `skills/` (or external sources) and are what the AI assistant actually loads.
- `skills-lock.json` — Tracks which skills are installed and their source hashes.

When a user mentions skills, skill construction, or innovation kits, refer to the `skills/` directory unless they specifically say otherwise.

## Guidelines
- This repository contains Microsoft Research prototypes intended as reference implementations.
- Never include secrets, credentials, or tokens in any committed file, documentation, or console output.
- Do not fabricate results, logs, benchmarks, or metrics.

