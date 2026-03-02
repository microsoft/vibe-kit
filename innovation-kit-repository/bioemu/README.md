# BioEmu Innovation Kit

BioEmu helps you generate and analyze protein conformational ensembles for structural biology and drug discovery prototyping.

## Useful links

- Skill definition: [SKILL.md](./SKILL.md)
- Quick start: [docs/quick-start.md](./docs/quick-start.md)
- Model details: [docs/model-details.md](./docs/model-details.md)
- BioEmu GitHub repository: https://github.com/microsoft/bioemu
- BioEmu model in Azure AI Foundry: https://ai.azure.com/explore/models/BioEmu

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
VIBEKIT_BASE_PATH='https://github.com/microsoft/vibe-kit/tree/main/innovation-kit-repository' uvx --from 'git+https://github.com/microsoft/vibe-kit.git#subdirectory=vibekit-cli' vibekit install bioemu
```

PowerShell:

```powershell
$env:VIBEKIT_BASE_PATH='https://github.com/microsoft/vibe-kit/tree/main/innovation-kit-repository'; uvx --from 'git+https://github.com/microsoft/vibe-kit.git#subdirectory=vibekit-cli' vibekit install bioemu
```
