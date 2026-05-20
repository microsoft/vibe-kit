# What is BioEmu?

**BioEmu is an AI system from Microsoft Research that predicts the full ensemble of shapes a protein takes — capturing motion, flexibility, and hidden binding sites that static structure predictors miss.**

---

## Contents

- [The Problem BioEmu Solves](#the-problem-bioemu-solves)
- [What BioEmu Can Do](#what-bioemu-can-do)
- [How BioEmu Works](#how-bioemu-works)
- [What is the Boltzmann Distribution?](#what-is-the-boltzmann-distribution)
- [Key Results](#key-results)
- [Real-World Applications](#real-world-applications)
- [Limitations](#limitations)
- [Scientific FAQ](#scientific-faq)
- [Training Data](#training-data)
- [Citation](#citation)
- [Learn More](#learn-more)

---

## The Problem BioEmu Solves

Proteins are not rigid. They exist as interconverting ensembles of structures, and a protein's function often depends on rare conformations — transient binding pockets, partial unfolding events, domain rearrangements — that a single static structure cannot capture.

Traditional approaches have sharp tradeoffs:

- **Molecular dynamics (MD) simulations** faithfully sample the distribution, but require microseconds-to-milliseconds of simulated time to reach rare states — often weeks of supercomputer time per protein.
- **Static structure predictors** (AlphaFold, ESMFold) produce a single "most likely" structure in seconds, but miss flexibility, alternative states, and thermodynamics entirely.

BioEmu samples directly from a protein's **equilibrium structural ensemble** given only the amino acid sequence, generating thousands of statistically independent conformations per hour on a single GPU — orders of magnitude faster than MD, while capturing the distribution MD is designed to reveal.

---

## What BioEmu Can Do

BioEmu predicts the *distribution* of structures a protein adopts at thermal equilibrium:

| Capability | What it captures | Performance |
|---|---|---|
| **Domain motion** | Large-scale rearrangements between domains | 83% coverage of reference states |
| **Local unfolding** | Regions that transiently unfold | 70–82% coverage |
| **Cryptic pockets** | Binding sites only present in certain conformations | 55% apo / 88% holo coverage |
| **Folding thermodynamics** | Relative stability of folded vs unfolded states | 0.9 kcal/mol MAE on ΔG |

All at sampling rates that make distribution-level analysis practical for routine prototyping.

---

## How BioEmu Works

```
Sequence --> [MSA Encoder] --> [Diffusion Model (DiG)] --> [Backbone Frames] --> Ensemble
             (ColabFold)       (score matching + PPFT)    (physically filtered)
```

### 1. Encoder: Reads the sequence

Takes an amino acid sequence and generates multiple sequence alignment (MSA) embeddings via ColabFold. The MSA encodes evolutionary information about which residues co-vary across related proteins — a proxy for structural constraints.

### 2. Diffusion model: Samples from the distribution

The core of BioEmu is **DiG** (Diffusion Generative), a neural network that iteratively denoises random noise into valid protein backbones. Each sampling run produces an independent conformation; running it thousands of times yields the ensemble.

**Score matching** trains the model to learn the gradient of the log-probability density of protein structures, enabling sampling via reverse diffusion.

**Property Prediction Fine-Tuning (PPFT)** — a novel technique introduced with BioEmu — aligns sampled ensembles with experimental folding free energies without requiring ground-truth ensemble distributions.

### 3. Decoder: Writes the structures

Outputs backbone frames (N, Cα, C, O atoms) in frame representation for efficiency. Structures are physically filtered to remove steric clashes and chain breaks. Side chains can be reconstructed optionally via HPacker.

### Training

| Phase | Objective | Data |
|-------|-----------|------|
| **Pretraining** | Denoising score matching | 161k flexible structures from AlphaFold Database (AFDB) |
| **Fine-tuning** | Score matching + PPFT | 216 ms MD simulations + 19k–1.3M experimental ΔG measurements |

### Model Variants

| Version | Parameters | Training Data | Notes |
|---------|------------|---------------|-------|
| **v1.0** | 31.4M | AFDB + 216 ms MD + 19k ΔG | Original preprint |
| **v1.1** | 31.4M | Same structures + 502k ΔG | Published Science paper |
| **v1.2** | 35.7M | AFDB + 145.4 ms MD + 1.3M ΔG | Extended training, extra embeddings |

---

## What is the Boltzmann Distribution?

At thermal equilibrium, a protein doesn't sit in one shape — it visits every possible shape with a probability determined by that shape's free energy:

```
P(state) ∝ exp(−G(state) / RT)
```

Lower-energy states are exponentially more probable. The Boltzmann distribution is what MD simulations are trying to sample and what experimental measurements average over.

**Why this matters:**
- **Drug discovery** — rare, high-energy conformations can expose druggable pockets invisible in the most-probable structure
- **Mutation effects** — a destabilizing mutation shifts the distribution toward unfolded states, raising the unfolded population
- **Interpretation** — BioEmu's output is the distribution itself, so the *frequency* of a conformation in your samples is a direct readout of its equilibrium probability

**Context for accuracy:** 1 kcal/mol ≈ 1.7 kT at room temperature. BioEmu's ~0.9 kcal/mol MAE on free energies means it distinguishes roughly 2-fold differences in state populations.

---

## Key Results

From the published research ([Science, 2025](https://www.science.org/doi/10.1126/science.adv9817)):

### Conformational change coverage

| Task | Metric | Performance |
|------|--------|-------------|
| Domain motion | Coverage of reference states | **83%** |
| Local unfolding (folded states) | Coverage | **70%** |
| Local unfolding (unfolded states) | Coverage | **82%** |
| Cryptic pockets (apo) | Coverage | **55%** |
| Cryptic pockets (holo) | Coverage | **88%** |

*Coverage = fraction of known conformational states sampled within threshold distance.*

### Thermodynamic accuracy

| Task | Metric | Performance |
|------|--------|-------------|
| MD equilibrium emulation | Free energy MAE | **0.9 kcal/mol** |
| Fast-folding proteins | Free energy MAE | **0.74 kcal/mol** |
| Experimental stability prediction | Free energy MAE | **0.9 kcal/mol** |
| Stability correlation | Spearman ρ | **0.6** |

### Throughput

Thousands of statistically independent conformations per hour on a single GPU, versus weeks of supercomputer time for equivalent MD sampling of rare states.

---

## Real-World Applications

### Drug discovery
Cryptic pockets are binding sites absent in the apo (unliganded) structure but exposed in certain conformations. BioEmu samples these transiently open states, enabling virtual screening against conformational ensembles and identification of druggable sites missed by static structures.

### Protein engineering
Predict destabilizing mutations before lab synthesis by comparing ensemble distributions of wild-type vs mutant. Increased unfolded-state population signals destabilization; shifted equilibria between folded conformations signal allosteric effects.

### Folding free energy estimation
BioEmu's ensemble directly encodes thermodynamic information:
```
ΔG_fold = -RT × ln(P_folded / P_unfolded)
```
Validated against experimental measurements with MAE ~0.9 kcal/mol.

### MD augmentation
Generate diverse starting conformations for targeted MD simulations, identify rare states that would require extensive MD to reach, or validate MD force fields against learned distributions.

### Mechanism studies
Generate testable hypotheses about allostery, conformational switches, and intermediate states without supercomputer time.

---

## Limitations

- **Monomers only.** Multi-chain complexes are not supported. The "linker trick" for multimers is unreliable.
- **No ligands.** Cannot model protein-small molecule interactions directly. Use ensembles as input to external docking tools for virtual screening.
- **Backbone only.** Side chains require separate reconstruction via HPacker or similar tools.
- **Training bias.** Inherits biases from AFDB predictions and the MD force fields used in fine-tuning data.
- **Disordered regions.** May produce steric clashes in highly disordered proteins.
- **Local mode requirements.** Running BioEmu locally requires Linux + Python 3.10+ and an NVIDIA GPU for reasonable performance.

---

## Scientific FAQ

### How does BioEmu differ from AlphaFold?
AlphaFold predicts a single "most likely" structure. BioEmu samples from the *distribution* of structures — capturing flexibility, multiple states, and thermodynamics. Use AlphaFold to find one answer; use BioEmu to find the answer space.

### How accurate is the free energy prediction?
~0.9 kcal/mol MAE validated against both MD simulations and experimental measurements. This is sufficient to distinguish roughly 2-fold differences in state populations.

### Can BioEmu predict protein-protein interactions?
No. The model is trained on monomers. Multi-chain predictions are out of scope.

### Why backbone-only output?
BioEmu represents structures in backbone frame representation for efficiency. Side chains can be reconstructed using HPacker or similar tools after sampling.

### How many samples are needed?
Depends on application:
- Quick visualization: 100–500 samples
- Statistical analysis: 1,000+ samples
- Rare state discovery: 5,000+ samples

---

## Training Data

| Dataset | Size | Description |
|---------|------|-------------|
| **AFDB** | 161k structures | Flexible regions from AlphaFold predictions |
| **CATH MD** | See [Zenodo](https://doi.org/10.5281/zenodo.15629740) | In-house MD simulations by protein fold |
| **Octapeptides** | See [Zenodo](https://doi.org/10.5281/zenodo.15641199) | Short peptide conformational sampling |
| **MegaSim** | See [Zenodo](https://doi.org/10.5281/zenodo.15641184) | Large-scale MD simulation data |
| **Experimental ΔG** | 19k–1.3M | Published folding free energies |

---

## Citation

```bibtex
@article{bioemu2025,
  title={Scalable emulation of protein equilibrium ensembles with generative deep learning},
  author={Lewis, Sarah and Hempel, Tim and Jiménez-Luna, José and Gastegger, Michael and others},
  journal={Science},
  pages={eadv9817},
  year={2025},
  publisher={American Association for the Advancement of Science},
  doi={10.1126/science.adv9817}
}
```

---

## Learn More

- **Try it locally:** [quick-start.md](quick-start.md) — three commands to sample your first ensemble on your own GPU, with an optional reference app for the full UI
- **Build with it:** [application-patterns.md](application-patterns.md) — Code examples for sampling and analysis
- **Research paper:** [Scalable emulation of protein equilibrium ensembles with generative deep learning](https://www.science.org/doi/10.1126/science.adv9817) (Science, 2025)
- **Paper (offline copy):** [bioemu-paper.pdf](../assets/paper/bioemu-paper.pdf) — bundled with this kit
- **DiG architecture:** [Nature Machine Intelligence](https://www.nature.com/articles/s42256-024-00837-3)
- **Source code:** [github.com/microsoft/bioemu](https://github.com/microsoft/bioemu)
- **Model weights:** [huggingface.co/microsoft/bioemu](https://huggingface.co/microsoft/bioemu)
- **Benchmarks:** [github.com/microsoft/bioemu-benchmarks](https://github.com/microsoft/bioemu-benchmarks)
