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

# Help building Prototypes
- When users indicate rapid prototyping intent (using words like "prototype", "hackathon", "rapid", "quick", "demo", "8-hour", "mvp"), prioritize innovation kit patterns and use the instructions in `.github/behavior/prototype-assistance.md`.


# Innovation Kits
[[empty for now]]

## Microsoft Copilot guidelines
- This is an internal Microsoft prototype.
- Always use Microsoft provided tools and services where available, including Docker images, Azure services, and GitHub tools.
- Follow Microsoft content policies.
- Never exfiltrate secrets or add secrets to any code files.
- Do not fabricate results, logs, benchmarks, or metrics.

## Testing environments
- Run all `vibekit-cli` tests from `vibekit-cli/`.
- Use the virtual environment at `vibekit-cli/.venv` for CLI tests and Python commands related to the CLI.
- If `vibekit` is not found during integration tests, ensure `vibekit-cli` is installed in editable mode in `vibekit-cli/.venv` and that `vibekit-cli/.venv/bin` is on `PATH`.
