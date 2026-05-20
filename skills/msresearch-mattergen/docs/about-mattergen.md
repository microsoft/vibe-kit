# What is MatterGen?

**MatterGen is a generative AI model from Microsoft Research that designs new inorganic crystals on demand — conditioned on the properties you actually care about, like strength, magnetism, or band gap.**

---

## Contents

- [The Problem MatterGen Solves](#the-problem-mattergen-solves)
- [What MatterGen Can Do](#what-mattergen-can-do)
- [How MatterGen Works](#how-mattergen-works)
- [What is MatterSim?](#what-is-mattersim)
- [Key Results](#key-results)
- [Real-World Applications](#real-world-applications)
- [Limitations](#limitations)
- [Learn More](#learn-more)

---

## The Problem MatterGen Solves

The space of possible inorganic materials is effectively infinite — billions of combinations of elements, stoichiometries, and crystal structures. Finding ones with useful properties (high bulk modulus, specific band gap, strong magnetism, low supply-chain risk) has traditionally meant:

- **Screening huge databases** of known materials with density functional theory (DFT) — slow, expensive, and limited to materials someone already proposed
- **Running ab initio random structure search** — computationally brutal and rarely property-targeted
- **Years of expert intuition and trial-and-error** in the lab

This means materials discovery for batteries, magnets, superconductors, and catalysts moves on decade timescales, even though the underlying need (cleaner energy, supply-chain resilience, new electronics) is urgent.

MatterGen flips the loop. Instead of screening existing candidates, it **generates novel, stable crystal structures directly conditioned on the properties you want**. You ask for "a magnet with high magnetic density and low supply-chain risk," and it proposes structures that didn't exist in any database five minutes ago.

---

## What MatterGen Can Do

MatterGen is a **base diffusion model** that can be steered in several ways via lightweight adapter modules:

| Mode | What you specify | Example use |
|---|---|---|
| **Unconditional** | Nothing — sample broadly across chemistries | Explore the inorganic crystal landscape |
| **Chemistry-conditioned** | Target chemical system (e.g., Li-Co-O) | Search for new phases in a known system |
| **Symmetry-conditioned** | Target space group | Find candidates with desired structural motifs |
| **Property-conditioned** | Target bulk modulus, band gap, magnetic density, etc. | Design materials for a specific application |
| **Multi-property** | Combine targets (e.g., high magnetism *and* low HHI supply risk) | Find practical, deployable materials |

All conditioning is done with **small adapter modules** (~tens of MB) fine-tuned on the property of interest, rather than retraining the base model.

---

## How MatterGen Works

MatterGen is a **diffusion model over crystal structures**. Diffusion models work by learning to reverse a noising process — starting from random noise and gradually denoising it into something coherent.

```
Noise --> [Score Network] --> [Adapter Modules] --> Crystal Structure
              |                      |
              |                      +-- Property targets
              |                          (bulk modulus, band gap, ...)
              |
              +-- Joint diffusion over:
                  - Atom types (categorical)
                  - Fractional coordinates (continuous, periodic)
                  - Lattice vectors (continuous)
```

### 1. Joint diffusion over three coupled variables

A crystal is defined by three things that all have to be consistent: **which atoms** are in the unit cell, **where** they sit (fractional coordinates), and the **shape** of the unit cell (lattice). MatterGen runs a coupled diffusion process over all three simultaneously, with custom noise schedules for each (categorical for atom types, periodic for coordinates, continuous for the lattice).

### 2. Score network: equivariant graph neural net

The denoising network is an SE(3)-equivariant graph neural network that respects the physical symmetries of crystals — translations, rotations, and periodic boundaries. This means the model doesn't have to "learn" basic physics like "rotating the crystal shouldn't change its energy."

### 3. Adapter modules for property conditioning

Once the base model is pretrained, MatterGen adds small adapter modules that take a target property value (a scalar like "bulk modulus = 200 GPa") and inject it into the score network. Adapters are fine-tuned on small labeled datasets (~thousands of examples), making it cheap to add new conditioning targets.

### Training data: Alex-MP-20

The base model was pretrained on **Alex-MP-20** — a combined dataset of ~607,000 stable inorganic crystals (≤20 atoms per unit cell) drawn from the Alexandria database and Materials Project. This is roughly an order of magnitude more training data than prior generative crystal models used.

---

## What is MatterSim?

MatterSim is a separate Microsoft Research model that pairs naturally with MatterGen: **MatterGen proposes candidates, MatterSim evaluates and relaxes them**.

**What it is:**
- A deep-learning **interatomic potential** (force field) covering the full periodic table
- Trained for accuracy across **0–5000 K and up to 1000 GPa** — broad enough for most real-world materials science
- Built on the M3GNet graph neural network architecture
- Released as two pretrained checkpoints: a 1M-parameter model (faster) and a 5M-parameter model (more accurate)

**Why MatterGen needs it:**

Generated crystals are only useful if they're physically reasonable — the atoms have to sit at low-energy positions, the structure has to be dynamically stable, and the predicted properties have to hold up. Running DFT on every generated candidate is too slow. MatterSim acts as a **fast triage layer**:

1. MatterGen generates raw candidate structures
2. MatterSim relaxes each structure (finds the local energy minimum) and filters out unphysical ones
3. Surviving candidates get scored on properties of interest
4. Only the top survivors go to expensive DFT or experimental synthesis

This pipeline is what makes MatterGen practical at scale — turning thousands of raw generative samples into a short list of credible experimental targets.

**Reported gains** (MatterSim paper, arXiv:2405.04967): ~10x precision improvement over prior best models on benchmarks, 15 meV/atom resolution on Gibbs free energies up to 1000 K, and up to 97% data-efficiency improvements when fine-tuned on new property datasets.

MatterSim is MIT-licensed and installable separately via `pip install mattersim`.

---

## Key Results

From the MatterGen Nature paper (Zeni et al., Nature 2025):

- **Generates stable, unique, novel (S.U.N.) structures** at more than **2x the rate** of prior state-of-the-art generative models (CDVD, DiffCSP) on the same benchmarks
- **Higher fraction of candidates near the convex hull** (i.e., thermodynamically favorable) than baselines, with stability rates substantially above prior diffusion-based crystal generators
- **Property-conditioned generation works across multiple targets** — bulk modulus, magnetic density, band gap, and combinations thereof — with conditioning shifting the output distribution toward the requested target
- **Multi-property conditioning** (e.g., "high magnetic density *and* low HHI supply-chain risk") successfully finds candidates satisfying both constraints simultaneously, where neither random sampling nor single-property models reliably do
- **Experimental validation of TaCr₂O₆**: a candidate generated by MatterGen and conditioned on a target bulk modulus was synthesized in the lab; the measured properties matched the model's prediction within experimental uncertainty, demonstrating an end-to-end design → synthesis loop

---

## Real-World Applications

- **Permanent magnets** — Design rare-earth-free magnets with high magnetic density and low supply-chain risk (HHI conditioning)
- **Battery materials** — Generate cathode and electrolyte candidates with target voltage, capacity, or ionic conductivity
- **Superconductors** — Search structural and chemical space for candidates with desired electronic properties
- **Catalysts** — Propose stable surfaces and bulk phases for energy and chemical applications
- **Optoelectronics** — Find semiconductors with specific band gaps for solar, LED, or detector use
- **Structural materials** — Hard, lightweight, or thermally stable crystals for aerospace and manufacturing

The shared pattern: define a property target (or a multi-property combination), generate hundreds-to-thousands of candidates, triage with MatterSim, and hand the top dozens to DFT or a synthesis lab.

---

## Limitations

- **Inorganic crystals only.** MatterGen does not generate molecules, polymers, MOFs, or surfaces. The diffusion process is built around periodic 3D crystal structures.
- **DFT or experimental validation still required.** MatterGen + MatterSim narrows the search dramatically, but final property confirmation needs DFT or synthesis. The skill explicitly hands DFT off to computational chemistry teams.
- **Conditioning needs labeled data.** Adding a new property adapter requires a labeled dataset (~thousands of structure → property pairs). For exotic properties this can be the bottleneck.
- **Up to 20 atoms per unit cell.** The released base model was trained on Alex-MP-20 (≤20 atoms/cell). Larger unit cells require retraining.
- **GPU strongly recommended.** Generation runs on CPU but is impractical at scale. 16 GB VRAM recommended for reasonable batch sizes.
- **Python 3.10 only.** `torch_cluster` wheels do not build cleanly on 3.11+.

---

## Learn More

- **Try it yourself:** [quick-start.md](quick-start.md) — Install MatterGen, generate 16 samples, try the hosted endpoint
- **Research paper:** [A generative model for inorganic materials design](https://www.nature.com/articles/s41586-025-08628-5) (Nature, 2025)
- **Source code:** [github.com/microsoft/mattergen](https://github.com/microsoft/mattergen)
- **Model weights:** [huggingface.co/microsoft/mattergen](https://huggingface.co/microsoft/mattergen)
- **Azure deployment:** [Azure AI Foundry](https://ai.azure.com/catalog/models/MatterGen)
- **MatterSim paper:** [MatterSim: A deep learning atomistic model across elements, temperatures and pressures](https://arxiv.org/abs/2405.04967) (arXiv, 2024)
- **MatterSim code:** [github.com/microsoft/mattersim](https://github.com/microsoft/mattersim)
