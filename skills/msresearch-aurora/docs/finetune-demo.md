# Demo App: Explore Aurora Without Fine-Tuning

**See what Aurora produces — interactively, in five minutes, with no GPU and no training.**

The Aurora Finetune Exploration Demo is a small web app that lets you scrub through how training data size affects Aurora's weather predictions. It's the recommended starting point if you're not yet sure whether fine-tuning is right for you.

---

## Contents

- [What You'll See](#what-youll-see)
- [Why Use the Demo First](#why-use-the-demo-first)
- [Launch](#launch)
- [Using the UI](#using-the-ui)
- [What's Bundled vs. What Isn't](#whats-bundled-vs-what-isnt)
- [Local Development](#local-development)
- [Next Steps](#next-steps)
- [Related Resources](#related-resources)

---

## What You'll See

Three panels driven by a small set of controls:

- **Input controls** — pick a training dataset size (1 week / 2 months / 6 months), a weather variable (total cloud cover), a training epoch (0–8), and a validation sample.
- **Loss curves** — training and validation MAE over epochs, with a persistence baseline as the reference floor. Watch how more training data shifts the curves.
- **Heatmap comparison** — three synchronized geographic heatmaps over Greece: the finetuned model's prediction, the persistence baseline, and ground truth observations.

Everything is served from a pre-warmed cache. You're exploring real Aurora outputs without running any inference yourself.

---

## Why Use the Demo First

Fine-tuning Aurora well requires data preparation, GPU time, and engineering judgment about loss functions, learning rates, and gradient stability. Before investing in any of that, you probably want to know:

- What does an Aurora prediction actually look like?
- How much does training data quantity matter for my use case?
- How does Aurora compare against a naive baseline?

The demo answers all three in a few minutes, with nothing to install beyond Docker.

---

## Launch

From the skill root:

```bash
cd .agents/skills/msr-aurora/assets/finetune/finetune-exploration-demo-app
docker compose up --build
```

Then open <http://localhost:8101> in your browser.

The first build takes a few minutes (Python + Node + Nginx). Subsequent launches reuse the cached images and start in seconds.

To stop:

```bash
docker compose down
```

> **No Docker?** See [Local Development](#local-development) for a two-terminal `uv` + `npm` flow.

---

## Using the UI

1. **Pick a training dataset** — start with "1 week" to see how a small dataset performs, then jump to "6 months" to see the effect of more data.
2. **Choose an epoch** — slide through epochs 0–8 to watch the model improve over training.
3. **Pick a sample index** — different validation cases reveal where the model does well and where it struggles.
4. **Compare heatmaps** — the prediction, persistence baseline, and ground truth share a color scale, so visual differences map directly to error.

Try this sequence: 1-week dataset at epoch 0 (untrained), then 1-week at epoch 8 (overfit on too little data), then 6-month at epoch 8 (well-trained). The story shows up immediately in the loss curves and heatmaps.

---

## What's Bundled vs. What Isn't

The skill ships the **cached results** the React UI depends on. This is enough to drive every interaction in the bundled UI flows.

| Bundled in the skill | Not bundled |
|---|---|
| Pre-computed evaluation results (`assets/outputs/`) | Raw ERA5 GRIB data |
| Persistence baseline metrics | Model checkpoints (`tb_logs/`) |
| Pre-warmed LMDB heatmap cache (~28 MB) | PyTorch + CUDA + model dependencies |

The default Docker build runs in **slim mode**, which serves cached responses only. Endpoints that would require live inference return HTTP 503 and aren't reached by the bundled UI.

If you want to enable live inference (and you have GRIB data and checkpoints handy), see the [demo app's README](../assets/finetune/finetune-exploration-demo-app/README.md#enabling-live-inference-advanced).

---

## Local Development

If you want to iterate on the React or FastAPI code rather than just run the demo, the two sub-READMEs cover dev workflows in detail:

- [`backend/README.md`](../assets/finetune/finetune-exploration-demo-app/backend/README.md) — FastAPI setup with `uv`, Swagger UI, CLI utilities for regenerating cached data
- [`frontend/README.md`](../assets/finetune/finetune-exploration-demo-app/frontend/README.md) — Vite dev server, proxy configuration, project structure

In short:

```bash
# Terminal 1 — backend
cd assets/finetune/finetune-exploration-demo-app/backend
uv sync
uv run uvicorn aft_demo_backend.api:app --host 0.0.0.0 --port 8000

# Terminal 2 — frontend (after adding the Vite proxy from frontend/README.md)
cd assets/finetune/finetune-exploration-demo-app/frontend
npm install
npm run dev
```

---

## Next Steps

Once you've explored the demo and want to actually fine-tune Aurora on your own data:

1. Read [about-finetune.md](about-finetune.md) — what fine-tuning unlocks and who should do it
2. Walk through [quick-start-finetune.md](quick-start-finetune.md) — first fine-tuning experiment on bundled ERA5 data
3. Deep dive [finetuning-guide.md](finetuning-guide.md) — gradients, AMP, variable extension

---

## Related Resources

- [Demo app README](../assets/finetune/finetune-exploration-demo-app/README.md) — full directory overview
- [Backend README](../assets/finetune/finetune-exploration-demo-app/backend/README.md) — FastAPI internals and CLI tools
- [Frontend README](../assets/finetune/finetune-exploration-demo-app/frontend/README.md) — React app structure and dev setup
