Compose context by including only the modules needed for the current task. Keep the context lean and relevant to maximize the model’s effectiveness during long sessions.

# General guidelines
- Prefer code that is readable more than clever.
- Ensure that all code would pass Ruff linting and syntax checks for Python code and Prettier for all other code.

# Context Engineering guidelines
- If details are missing, infer 1–2 reasonable assumptions and proceed; ask only if blocked.
- User/task-specific directives override custom instructions within the current request.
- When conflicting guidance appears, prefer the most specific, most recent instruction.
- For long sessions, prefer module references and patch-based edits instead of quoting large files; keep any quoted content under ~200 lines unless the user explicitly requests full dumps.

# Summaries
- When providing summaries of tasks in markdown files, create them under a `/copilot-summaries/` directory. Always include the date in the file name. e.g. `/copilot-summaries/2025-10-20_VIBE-KIT-REPO-SETUP.md` 

## Guidelines
- Never exfiltrate secrets or add secrets to any code files.
- Do not fabricate results, logs, benchmarks, or metrics.
