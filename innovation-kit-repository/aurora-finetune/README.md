# Aurora Finetuning Innovation Kit

Aurora Finetuning helps you adapt Aurora to custom variables and datasets, including data-shape validation, training, and evaluation workflows.

## Useful links

- Skill definition: [SKILL.md](./SKILL.md)
- Quick start: [docs/quick-start.md](./docs/quick-start.md)
- Finetuning guide: [docs/aurora-finetuning-guide.md](./docs/aurora-finetuning-guide.md)
- Aurora GitHub repository: https://github.com/microsoft/aurora
- Aurora model in Azure AI Foundry: https://ai.azure.com/catalog/models/Aurora

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
VIBEKIT_BASE_PATH='https://github.com/microsoft/vibe-kit/tree/main/innovation-kit-repository' uvx --from 'git+https://github.com/microsoft/vibe-kit.git#subdirectory=vibekit-cli' vibekit install aurora-finetune
```

PowerShell:

```powershell
$env:VIBEKIT_BASE_PATH='https://github.com/microsoft/vibe-kit/tree/main/innovation-kit-repository'; uvx --from 'git+https://github.com/microsoft/vibe-kit.git#subdirectory=vibekit-cli' vibekit install aurora-finetune
```
