---
description: Dayhoff Innovation Kit context and file locations for protein design workflows
applyTo: "**/*"
---

# Dayhoff Innovation Kit

## What is Dayhoff?

Hybrid Mamba + Transformer protein models trained on the 3.34 B-sequence Dayhoff Atlas to accelerate sequence ideation and zero-shot mutation scoring.

- **Focus**: Rapid protein ideation with defensible likelihood metrics
- **Scope**: Unconditional design, zero-shot mutation scoring, motif-aware extension, and custom workflows
- **Timeline**: Hour 1 → GPU-backed hello world | Hours 2–4 → Mutation workflows | Hours 4–8 → Custom integration

## Key Advantages

- **Atlas-scale diversity**: 3.34 B metagenomic sequences + 46 M synthetic backbones boost expression rates vs. UniRef-only baselines (source: research preprint)
- **Fast iteration**: Dayhoff-170m-GR samples 5–10 sequences/sec on a single L4-class GPU while exposing log-likelihood metrics for triage (source: prototype runtime logs)

## Kit Location

`.vibe-kit/innovation-kits/dayhoff/`

This is the installed kit location in the user's workspace (installed via `vibekit install dayhoff`). All paths in this document are relative to this location.

## Security Rules (CRITICAL)

- **NEVER** request API keys, credentials, tokens, or secrets from the user
- **NEVER** display, log, or echo credential values in responses or terminal output
- If credentials are missing or invalid, state requirement generically ("Set `DAYHOFF_KEY` in your environment") and provide registration links—do not prompt for values
- Assume credentials are managed through proper secret management systems

## Biosecurity Guardrails

- Treat every generated sequence as a _research draft_ until a qualified reviewer signs off
- Keep human-in-the-loop oversight on every sequence that exits the sandbox
- Log prompts, checkpoints, and reviewers for audit trails
- Review `docs/alignment-constitution.md` before any sequence export or sharing

## Reference App Launch (CRITICAL — Follow Exactly)

The kit includes a React + Flask web app for interactive sequence generation. The app uses the **Dayhoff-170m-GR** model by default.

**Installed kit location:** `.vibe-kit/innovation-kits/dayhoff/`

### Copilot Behavior Rules (CRITICAL)

1. **SEPARATE TERMINALS** — Backend runs in Terminal A, Frontend runs in Terminal B. NEVER mix backend and frontend commands in the same terminal.
2. **No polling or checking** — Do NOT run curl, sleep, or status checks. Just start the apps and tell the user the URL
3. **Sequential execution** — Complete each step fully before moving to the next
4. **Model download warning** — First run downloads the model (~700MB for 170M, larger for 3B)

### Step 1: Terminal 1 (Backend) — Install and Start Backend

**CRITICAL**: Backend runs in its own dedicated terminal. NEVER run frontend commands in this terminal.

Say this to the user before running:

> "Installing backend dependencies — this may take **several minutes**. The model download on first run will take additional time."

Run in Terminal 1 (isBackground=false, wait for completion):

```bash
cd .vibe-kit/innovation-kits/dayhoff/assets/dayhoff-prototype/backend && pip install -r requirements.txt
```

Then in the **SAME Terminal 1**, start the backend as background process (isBackground=true):

```bash
cd .vibe-kit/innovation-kits/dayhoff/assets/dayhoff-prototype/backend && python app.py
```

Tell the user:

> "Backend starting on port 5001. **First run downloads the model (~700MB)** — watch for 'Model loaded successfully'."

### Step 2: Terminal 2 (Frontend) — Install and Start Frontend

**CRITICAL**: Frontend runs in a **COMPLETELY SEPARATE terminal from the backend**. This is Terminal 2.

**NEVER execute these frontend commands in Terminal 1 where the backend is running.**

Run in Terminal 2 (isBackground=false):

```bash
cd .vibe-kit/innovation-kits/dayhoff/assets/dayhoff-prototype/frontend && npm install
```

Then in the **SAME Terminal 2**, start dev server (isBackground=true):

```bash
cd .vibe-kit/innovation-kits/dayhoff/assets/dayhoff-prototype/frontend && npm run dev
```

Tell the user:

> "Both servers are running! Open **http://localhost:5173** in your browser."

**Do NOT run any curl/wget/sleep commands to check status.**

### Step 3: Try Sequence Generation

In the web interface:

1. Enter a starting prompt (e.g., `M` for unconditional generation, or a motif like `MKTAYIAKQRQ`)
2. Set parameters: sequence count, max length, temperature
3. Click **Generate** and view fitness scores

### Alternative: CLI Quick Test

For a non-interactive test without the web app:

```bash
cd <kit-location>/assets/dayhoff-prototype/backend
python cli.py --prompt "M" --num 3 --length 80
```

This generates 3 sample sequences and prints them to console.

### Hardware Notes

| Environment        | Speed        | Notes                     |
| ------------------ | ------------ | ------------------------- |
| CPU only           | ~1 seq/min   | Functional but slow       |
| NVIDIA L4 (24GB)   | ~6 seq/sec   | Recommended for iteration |
| NVIDIA A100 (40GB) | ~10+ seq/sec | Production workloads      |

## File Index (Read These as Needed)

### Getting Started

**Kit Overview**: `INNOVATION_KIT.md` — Entry point with reference links and summary

**Quick Start**: `docs/quick-start.md` — Hello world (CPU or GPU), CLI + Flask UI, enterprise vs local paths

### Documentation

**Application Patterns**: `docs/application-patterns.md` — Unconditional design, mutation prioritization, batch sampling, motif preservation

**Prototype Expansion**: `docs/prototype-expansion.md` — Extending the reference app with REST APIs, batch processing, databases, validation

**Data Integration**: `docs/data-integration.md` — GigaRef/BackboneRef/DayhoffRef downloads, Hugging Face adapters, FASTA/Arrow/JSONL formats

**Alignment & Safety**: `docs/alignment-constitution.md` — Biosecurity guardrails, responsible use principles, agent automation rules

**Troubleshooting**: `docs/troubleshooting.md` — mamba-ssm, causal-conv1d, CUDA, HTTP 401, rate limits

**Performance Guide**: `docs/performance-guide.md` — GPU sizing, batching, throughput estimates, scaling strategies

### Assets

**Prototype Web App**: `assets/dayhoff-prototype/` — React frontend + Flask backend

- Backend: `backend/app.py` (Flask API on port 5001)
- Frontend: `frontend/` (Vite + React on port 5173)
- Generator: `backend/generator.py` (DayhoffGenerator class)
- CLI: `backend/cli.py` (Command-line interface)

**Research Paper**: `assets/paper/` — Preprint PDF for reference

## Quick Routing

- **"Where do I start?"** -> `docs/quick-start.md`
- **"How do I generate protein sequences?"** -> Follow Reference App Launch above, or `docs/application-patterns.md#unconditional-sequence-generation`
- **"How do I score mutations?"** -> `docs/application-patterns.md#zero-shot-mutation-prioritization`
- **"How do I expand the prototype?"** -> `docs/prototype-expansion.md`
- **"How do I load the Dayhoff Atlas datasets?"** -> `docs/data-integration.md`
- **"What are the safety guardrails?"** -> `docs/alignment-constitution.md`
- **"Build keeps failing on mamba-ssm / CUDA"** -> `docs/troubleshooting.md`
- **"Can I scale batch generation?"** -> `docs/performance-guide.md`

## Official Resources

- GitHub: https://github.com/microsoft/dayhoff
- Preprint: https://aka.ms/dayhoff/preprint
- Model Collection: https://huggingface.co/collections/microsoft/dayhoff-atlas-6866d679465a2685b06ee969
- Azure AI Foundry: https://ai.azure.com/catalog/models/Dayhoff-170m-GR

## Key Workflows

1. **Hello World**: Run `docs/quick-start.md` snippet to confirm model access (enterprise or local)
2. **Unconditional Generation**: Sample diverse scaffolds with temperature/top-k/top-p tuning
3. **Mutation Scoring**: Compute delta log-likelihood for single-point variants vs. wild-type
4. **Custom Integration**: Export sequences in FASTA/JSON for downstream tools
5. **Scale**: Batch prompts, use half-precision, distribute across GPUs or Azure Batch

## Common Issues

See `docs/troubleshooting.md` for solutions to common problems including:

- `ValueError: Fast Mamba kernels not available`
- `HTTP 401 Unauthorized`
- `HuggingFaceHubHTTPError: 429`
- Disk pressure on dataset download

## First Message Guidance (Chat Mode Greeting)

When a user first engages in Dayhoff chat mode, greet them concisely:

> "Hi! I'm your Dayhoff assistant. Dayhoff is a hybrid Mamba + Transformer protein model trained on 3.34B metagenomic sequences for rapid protein sequence generation and mutation scoring.
>
> Want to launch the prototype app?"
