# What is Dayhoff?

**Dayhoff is a family of protein language models from Microsoft Research that generate novel protein sequences and score variants, trained on the 3.34-billion-sequence Dayhoff Atlas of natural and structure-derived synthetic proteins.**

---

## Contents

- [The Problem Dayhoff Solves](#the-problem-dayhoff-solves)
- [What Dayhoff Can Do](#what-dayhoff-can-do)
- [How Dayhoff Works](#how-dayhoff-works)
- [The Dayhoff Atlas](#the-dayhoff-atlas)
- [Model Variants](#model-variants)
- [Capabilities Matrix](#capabilities-matrix)
- [Benchmark Results](#benchmark-results)
- [Real-World Applications](#real-world-applications)
- [Limitations and Responsible Use](#limitations-and-responsible-use)
- [Citation](#citation)
- [Learn More](#learn-more)

---

## The Problem Dayhoff Solves

Designing new proteins — for enzymes, therapeutics, biosensors, or basic science — has historically required either painstaking rational design or many rounds of directed evolution. Both are slow, expensive, and biased toward sequences close to known natural proteins.

Modern protein language models (PLMs) accelerate this by learning the distribution of viable protein sequences and sampling new candidates. But existing PLMs are trained almost exclusively on curated natural sequences (e.g., UniRef), which are a tiny, biased slice of protein space — they under-represent metagenomic diversity and contain no genuinely novel folds.

Dayhoff addresses two limitations together:

- **Data scale and diversity** — trains on the **Dayhoff Atlas**, a 3.34-billion-sequence corpus that combines curated natural sequences (UniRef), clustered metagenomic data (GigaRef), MSA-style homologs (OpenProteinSet), and structure-derived synthetic sequences (BackboneRef) covering folds that don't exist in nature.
- **Architecture** — uses a **hybrid Mamba + Transformer + Mixture-of-Experts** design that scales efficiently to long sequences and large model sizes while preserving the in-context learning needed for homolog conditioning.

The result: a single model family that supports unconditional generation, motif scaffolding, homolog-guided design, and zero-shot fitness scoring, with state-of-the-art results on standard benchmarks.

---

## What Dayhoff Can Do

| Capability | What it does | Best variant |
|---|---|---|
| **Unconditional generation** | Generate novel protein sequences from scratch (or from a short prompt) | `3b-UR90` |
| **Motif scaffolding** | Generate sequences that preserve a structural/functional motif | `3b-GR-HM` |
| **Zero-shot fitness scoring** | Predict whether a mutation helps or hurts function, without experimental data | `3b-GR-HM-c` |
| **Homolog-conditioned generation** | Generate sequences in a specific protein family given related sequences | `3b-GR-HM-c` or `3b-GR-HM` |
| **Fast exploration** | Generate many novel-fold candidates quickly on modest GPUs | `170m-UR50-BRn` |
| **Bidirectional generation** | Sample N→C or C→N (reverse) | All variants |

---

## How Dayhoff Works

```
Input prompt (sequence or empty) ──> [Tokenizer] ──> [Hybrid Mamba + Transformer + MoE] ──> Generated sequence
                                                          ▲
                                                          │
                          Optional: homolog FASTA ────────┘  (3b-GR-HM and 3b-GR-HM-c only)
```

### Hybrid architecture

Dayhoff models interleave **Mamba** state-space layers with **Transformer** attention layers, then use a **Mixture-of-Experts** feed-forward block. This combination gives:

- **Linear-time sequence processing** from Mamba — enables long-context generation (1000+ residues) without quadratic attention cost.
- **In-context homolog conditioning** from Transformer attention — lets the model attend across multiple homologous sequences provided at inference time.
- **Capacity without inference cost** from MoE — scales the parameter count while activating only a subset of experts per token.

### Zero-shot fitness scoring

Given a sequence, the model computes its log-likelihood under the learned distribution. The delta between a wild-type and a mutant log-likelihood ranks the mutant's predicted fitness — no fine-tuning or experimental data required.

### Bidirectional generation

The training data was augmented with reversed sequences, so the same checkpoint can generate either N→C (standard) or C→N (reverse). Reverse generation is useful for completing sequences from a known C-terminus.

---

## The Dayhoff Atlas

The training corpus combines four data sources, totaling ~3.34 billion sequences:

| Source | Size | Description |
|---|---|---|
| **UniRef50 / UniRef90** | ~250 M | Curated natural sequences clustered at 50% / 90% identity |
| **GigaRef** | ~3 B | Clustered metagenomic sequences — vastly increases diversity beyond UniRef |
| **OpenProteinSet** | ~16 M MSAs | Multiple sequence alignments providing homolog context |
| **BackboneRef-novelty (BBR-n)** | ~10 M | Structure-derived synthetic sequences from backbones with TM-score < 0.5 to any natural fold — genuinely novel folds |

Different model variants are trained on different subsets, which is why each variant has different strengths (see [Model Variants](#model-variants)).

The Atlas itself is also released as a [Hugging Face dataset](https://huggingface.co/collections/microsoft/dayhoff-atlas-6866d679465a2685b06ee969) for downstream use.

---

## Model Variants

All four variants share the same architecture and API. They differ in training data and parameter count.

| Model | Params | Training Data | Key Strength |
|---|---|---|---|
| **3b-GR-HM-c** | 3 B | GigaRef + OpenProteinSet homologs, then cooled on UniRef90 + homologs | Best zero-shot fitness prediction; homolog conditioning |
| **3b-GR-HM** | 3 B | GigaRef + OpenProteinSet homologs (no cooling) | Best motif scaffolding; homolog conditioning |
| **3b-UR90** | 3 B | UniRef90 only (natural sequences) | Strongest unconditional generation; highest structural plausibility |
| **170m-UR50-BRn** | 170 M | UniRef50 + BackboneRef-novelty (synthetic novel folds) | Fast inference; structurally novel designs |

**Homolog conditioning support:** Only `3b-GR-HM-c` and `3b-GR-HM` accept a `homologs` FASTA input. The other two were not trained on MSA data and will error if homologs are provided.

---

## Capabilities Matrix

| Capability | 3b-GR-HM-c | 3b-GR-HM | 3b-UR90 | 170m-UR50-BRn |
|---|:---:|:---:|:---:|:---:|
| Unconditional generation | Yes | Yes | **Best** | Yes |
| Sequence completion (prompt) | Yes | Yes | Yes | Yes |
| N→C and C→N directions | Yes | Yes | Yes | Yes |
| Zero-shot fitness scoring | **Best** | Yes | Yes | Yes |
| Homolog-conditioned generation | Yes | Yes | **No** | **No** |
| Motif scaffolding | Strong | **Best** | Strong | Good |
| Inference speed | Slower (~6 GB) | Slower (~6 GB) | Slower (~6 GB) | **Fast** (~1 GB) |

---

## Benchmark Results

From the [Dayhoff preprint](https://aka.ms/dayhoff/preprint).

### ProteinGym Zero-Shot (Spearman ρ, higher = better)

| Model | Substitutions | Indels |
|---|:---:|:---:|
| 3b-GR-HM-c | **0.417** | 0.466 |
| 3b-UR90 | 0.394 | **0.497** |
| 170m-UR50-BRn | 0.341 | 0.478 |
| 3b-GR-HM | 0.328 | 0.423 |

### Generated Sequence Quality (ESMFold pLDDT, higher = better)

| Model | pLDDT (mean) | scPerplexity (mean, lower = better) |
|---|:---:|:---:|
| 3b-UR90 | **0.454** | 11.79 |
| 170m-UR50-BRn | 0.432 | 11.77 |
| 3b-GR-HM-c | 0.423 | 11.91 |
| 3b-GR-HM | 0.406 | **11.50** |

### RFDiffusion Motif Scaffolding (higher = better)

| Model | Problems Solved | Successes | Score |
|---|:---:|:---:|:---:|
| 3b-UR90 | **10** | **207** | **16.32** |
| 3b-GR-HM-c | 9 | 119 | 14.14 |
| 3b-GR-HM | 7 | 112 | 11.90 |
| 170m-UR50-BRn | 5 | 119 | 7.26 |

### MotifBench (higher = better)

| Model | Problems Solved | Successes | Score |
|---|:---:|:---:|:---:|
| 3b-UR90 | **7** | **141** | **8.36** |
| 3b-GR-HM | 6 | 119 | 4.96 |
| 3b-GR-HM-c | 5 | 96 | 4.48 |
| 170m-UR50-BRn | 4 | 8 | 2.75 |

---

## Real-World Applications

### Protein engineering and directed evolution

Use zero-shot fitness scoring to triage candidate mutations before wet-lab assays. A positive delta log-likelihood vs. wild-type is a model-based prior that the variant is at least as viable. Combine with experimental rounds of directed evolution to dramatically reduce assay burden.

### De novo protein design

Generate novel scaffolds with `3b-UR90` or fast novel-fold candidates with `170m-UR50-BRn`, then validate with a structure predictor (ESMFold, AlphaFold) and shortlist for synthesis.

### Family-guided design

Provide a FASTA of related sequences (homologs) to `3b-GR-HM-c` or `3b-GR-HM` and generate new members of a protein family that retain functional context.

### Motif scaffolding

Use `3b-GR-HM` to design sequences that scaffold a known structural or functional motif (e.g., active site, binding loop) into a novel surrounding fold.

### Dataset construction

Use the Dayhoff Atlas itself as training/evaluation data for downstream protein ML tasks, or sample DayhoffRef synthetic sequences as augmentation.

---

## Limitations and Responsible Use

- **Sequences are research drafts.** Generated sequences are predicted to be plausible by the model — they are not guaranteed to fold, function, or be safe. **Every sequence requires experimental validation before use.**
- **Biosecurity guardrails apply.** Do not use Dayhoff to design sequences targeting pathogens, toxins, dual-use applications, or human/animal subjects without appropriate review. The bundled toxin-screening filter (`backend/sequence_screening.py`) catches a small Select Agent reference set — it is a guardrail, not a guarantee. See [`responsible-use.md`](responsible-use.md) before any sequence export or sharing.
- **Not for clinical use.** The models, datasets, and code are provided for research and development only. They have not been validated for clinical decision-making.
- **Novelty cap.** Even the best variants struggle to generate high-quality sequences with **no** homology to any natural sequence — they are powerful interpolators across known protein space, not unbounded inventors.
- **Out of scope.** Dayhoff is not designed for natural language, DNA, RNA, or non-protein biological sequences.

---

## Citation

```bibtex
@article{dayhoff2025,
  title={The Dayhoff Atlas: scaling sequence diversity for improved protein generation},
  author={Microsoft Research Dayhoff Team},
  journal={bioRxiv},
  year={2025},
  url={https://aka.ms/dayhoff/preprint}
}
```

---

## Learn More

- **Try it locally:** [`quick-start.md`](quick-start.md) — Path A (no-GPU cached demo, one terminal) up to Path C (full local GPU stack, three terminals)
- **Read before exporting any sequence:** [`responsible-use.md`](responsible-use.md) — biosecurity guardrails + pre-export checklist
- **Build with it:** [`application-patterns.md`](application-patterns.md) — generation, fitness scoring, motif preservation, export

Full reference index (paper, source, model collection, Foundry) in [`../README.md`](../README.md).
