# Vibe Kit Core Skill

Vibe Kit Core provides shared guidance across innovation kits, including installation patterns, cross-kit workflow conventions, and reusable engineering guardrails.

## Useful links

- Skill definition: [SKILL.md](./SKILL.md)
- API design guidance: [docs/api-design.md](./docs/api-design.md)
- Frontend design guidance: [docs/design.md](./docs/design.md)
- Markdown guidance: [docs/markdown.md](./docs/markdown.md)
- Public Vibe Kit repository: https://github.com/microsoft/vibe-kit

## Install with vibekit CLI from the public repo

Install required tool (`uv`, includes `uvx`):

sh:

```sh
curl -LsSf https://astral.sh/uv/install.sh | sh
```

PowerShell:

```powershell
irm https://astral.sh/uv/install.ps1 | iex
```

sh:

```sh
VIBEKIT_BASE_PATH='https://github.com/microsoft/vibe-kit/tree/main/innovation-kit-repository' uvx --from 'git+https://github.com/microsoft/vibe-kit.git#subdirectory=vibekit-cli' vibekit install vibe-kit-core
```

PowerShell:

```powershell
$env:VIBEKIT_BASE_PATH='https://github.com/microsoft/vibe-kit/tree/main/innovation-kit-repository'; uvx --from 'git+https://github.com/microsoft/vibe-kit.git#subdirectory=vibekit-cli' vibekit install vibe-kit-core
```
