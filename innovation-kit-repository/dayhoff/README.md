# Dayhoff Atlas Innovation Kit

Dayhoff Atlas helps you prototype protein sequence generation and mutation scoring workflows using hybrid Mamba + Transformer modeling.

## Useful links

- Skill definition: [SKILL.md](./SKILL.md)
- Quick start: [docs/quick-start.md](./docs/quick-start.md)
- Application patterns: [docs/application-patterns.md](./docs/application-patterns.md)
- Dayhoff GitHub repository: https://github.com/microsoft/dayhoff
- Dayhoff model in Azure AI Foundry: https://ai.azure.com/catalog/models/Dayhoff-170m-GR

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
VIBEKIT_BASE_PATH='https://github.com/microsoft/vibe-kit/tree/main/innovation-kit-repository' uvx --from 'git+https://github.com/microsoft/vibe-kit.git#subdirectory=vibekit-cli' vibekit install dayhoff
```

PowerShell:

```powershell
$env:VIBEKIT_BASE_PATH='https://github.com/microsoft/vibe-kit/tree/main/innovation-kit-repository'; uvx --from 'git+https://github.com/microsoft/vibe-kit.git#subdirectory=vibekit-cli' vibekit install dayhoff
```
