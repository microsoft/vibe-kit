# BioEmu Model Science Reference

> **Source**: [Science paper](https://www.science.org/doi/10.1126/science.adv9817) (2025), [GitHub](https://github.com/microsoft/bioemu), [Hugging Face](https://huggingface.co/microsoft/bioemu)

## What BioEmu Does

BioEmu samples from a protein's **equilibrium structural ensemble** (Boltzmann distribution) given only the amino acid sequence. It generates thousands of statistically independent conformations per hour on a single GPU—orders of magnitude faster than molecular dynamics (MD) simulations.

**Key capability**: Predicts the *distribution* of structures a protein adopts, not just a single static structure.

---

## Core Scientific Concepts

### Protein Conformational Ensembles

Proteins are not rigid. They exist as ensembles of interconverting structures:

| Term | Definition |
|------|------------|
| **Conformational ensemble** | The set of all structures a protein samples at equilibrium |
| **Boltzmann distribution** | Probability distribution where each state's likelihood ∝ exp(−ΔG/RT) |
| **Metastable states** | Long-lived conformations separated by energy barriers |
| **Free energy (ΔG)** | Thermodynamic quantity determining state populations |

Traditional MD requires microseconds-to-milliseconds of simulation time to sample rare conformational changes. BioEmu learns to sample directly from the equilibrium distribution.

### What BioEmu Captures

- **Local unfolding** — regions that transiently unfold
- **Domain motions** — large-scale rearrangements between domains
- **Cryptic pockets** — binding sites only present in certain conformations
- **Folding thermodynamics** — relative stability of folded vs unfolded states

---

## Model Architecture

BioEmu uses the **DiG (Diffusion Generative)** architecture ([Nature Machine Intelligence, 2024](https://www.nature.com/articles/s42256-024-00837-3)).

### Training Approach

| Phase | Objective | Data |
|-------|-----------|------|
| **Pretraining** | Denoising score matching | 161k flexible structures from AlphaFold Database (AFDB) |
| **Fine-tuning** | Denoising score matching + Property Prediction Fine-Tuning (PPFT) | 216 ms MD simulations + 19k–1.3M experimental ΔG measurements |

**Score matching**: The model learns the gradient of the log-probability density, enabling sampling via reverse diffusion.

**PPFT (Property Prediction Fine-Tuning)**: Novel technique that aligns sampled ensembles with experimental folding free energies without requiring ground-truth ensemble distributions.

### Model Variants

| Version | Parameters | Training Data | Notes |
|---------|------------|---------------|-------|
| **v1.0** | 31.4M | AFDB + 216 ms MD + 19k ΔG | Original preprint |
| **v1.1** | 31.4M | Same structures + 502k ΔG | Published Science paper |
| **v1.2** | 35.7M | AFDB + 145.4 ms MD + 1.3M ΔG | Extended training, extra embeddings |

---

## Input/Output

### Input
- **Amino acid sequence** (single-chain monomer)
- **MSA embeddings** (generated via ColabFold automatically)

### Output
- **Backbone structures** in frame representation (N, Cα, C, O atoms)
- Physically filtered (no steric clashes or chain breaks by default)
- Side-chains reconstructed optionally via HPacker

---

## Quantitative Performance

### Conformational Change Coverage

| Task | Metric | Performance |
|------|--------|-------------|
| Domain motion | Coverage of reference states | **83%** |
| Local unfolding (folded states) | Coverage | **70%** |
| Local unfolding (unfolded states) | Coverage | **82%** |
| Cryptic pockets (apo) | Coverage | **55%** |
| Cryptic pockets (holo) | Coverage | **88%** |

*Coverage = fraction of known conformational states sampled within threshold distance*

### Thermodynamic Accuracy

| Task | Metric | Performance |
|------|--------|-------------|
| MD equilibrium emulation | Free energy MAE | **0.9 kcal/mol** |
| Fast-folding proteins | Free energy MAE | **0.74 kcal/mol** |
| Experimental stability prediction | Free energy MAE | **0.9 kcal/mol** |
| Stability correlation | Spearman ρ | **0.6** |

**Context**: 1 kcal/mol ≈ 1.7 kT at room temperature. Errors <1 kcal/mol mean BioEmu distinguishes 2-fold population differences.

---

## Scientific Applications

### 1. Cryptic Pocket Discovery
Cryptic pockets are binding sites absent in the apo (unliganded) structure but exposed in certain conformations. BioEmu samples these transiently open states, enabling:
- Virtual screening against conformational ensembles
- Identification of druggable sites missed by static structures

### 2. Mutation Effect Prediction
By comparing ensemble distributions of wild-type vs mutant:
- Predict destabilizing mutations (increased unfolded population)
- Identify allosteric effects (shifted conformational equilibria)
- Generate mechanistic hypotheses for experimental validation

### 3. Folding Free Energy Estimation
BioEmu's ensemble directly encodes thermodynamic information:
```
ΔG_fold = -RT × ln(P_folded / P_unfolded)
```
Validated against experimental measurements with MAE ~0.9 kcal/mol.

### 4. MD Simulation Augmentation
- Generate diverse starting conformations for targeted MD
- Identify rare states that would require extensive MD to sample
- Validate MD force fields against learned distributions

---

## Known Limitations

| Limitation | Details |
|------------|---------|
| **Monomers only** | Multi-chain complexes not supported (linker trick unreliable) |
| **No ligands** | Cannot model protein-small molecule interactions |
| **Backbone only** | Side-chains require separate reconstruction |
| **Training bias** | Inherits biases from AFDB predictions and MD force fields |
| **Disordered regions** | May produce clashes in highly disordered proteins |

---

## Training Data Sources

| Dataset | Size | Description |
|---------|------|-------------|
| **AFDB** | 161k structures | Flexible regions from AlphaFold predictions |
| **CATH MD** | See [Zenodo](https://doi.org/10.5281/zenodo.15629740) | In-house MD simulations by protein fold |
| **Octapeptides** | See [Zenodo](https://doi.org/10.5281/zenodo.15641199) | Short peptide conformational sampling |
| **MegaSim** | See [Zenodo](https://doi.org/10.5281/zenodo.15641184) | Large-scale MD simulation data |
| **Experimental ΔG** | 19k–1.3M | Published folding free energies |

---

## Frequently Asked Scientific Questions

### How does BioEmu differ from AlphaFold?
AlphaFold predicts a single "most likely" structure. BioEmu samples from the *distribution* of structures—capturing flexibility, multiple states, and thermodynamics.

### What is the Boltzmann distribution?
The probability of each state at thermal equilibrium:
```
P(state) ∝ exp(−G(state) / RT)
```
Lower free energy states are exponentially more probable.

### How accurate is the free energy prediction?
~0.9 kcal/mol MAE validated against both MD simulations and experimental measurements. This is sufficient to distinguish ~2-fold differences in state populations.

### Can BioEmu predict protein-protein interactions?
No. The model is trained on monomers. Multi-chain predictions are out of scope.

### Why backbone-only output?
BioEmu represents structures in backbone frame representation for efficiency. Side-chains can be reconstructed using HPacker or similar tools.

### How many samples are needed?
Depends on application:
- Quick visualization: 100–500 samples
- Statistical analysis: 1,000+ samples  
- Rare state discovery: 5,000+ samples

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

## Additional Resources

- **Benchmarks**: [github.com/microsoft/bioemu-benchmarks](https://github.com/microsoft/bioemu-benchmarks)
- **DiG Architecture**: [Nature Machine Intelligence](https://www.nature.com/articles/s42256-024-00837-3)
