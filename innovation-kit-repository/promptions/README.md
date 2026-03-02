# Promptions Innovation Kit

Promptions helps you prototype dynamic prompt middleware where AI-generated controls are rendered in UI, then replayed as structured prompt parameters.

## Useful links

- Skill definition: [SKILL.md](./SKILL.md)
- Quick start: [docs/quick-start.md](./docs/quick-start.md)
- Application patterns: [docs/application-patterns.md](./docs/application-patterns.md)
- Control schema reference: [docs/REFERENCE.md](./docs/REFERENCE.md)
- Promptions GitHub repository: https://github.com/microsoft/Promptions

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
VIBEKIT_BASE_PATH='https://github.com/microsoft/vibe-kit/tree/main/innovation-kit-repository' uvx --from 'git+https://github.com/microsoft/vibe-kit.git#subdirectory=vibekit-cli' vibekit install promptions
```

PowerShell:

```powershell
$env:VIBEKIT_BASE_PATH='https://github.com/microsoft/vibe-kit/tree/main/innovation-kit-repository'; uvx --from 'git+https://github.com/microsoft/vibe-kit.git#subdirectory=vibekit-cli' vibekit install promptions
```