# Dayhoff Application Patterns

**Domain-specific workflows and proven protein design implementations.**

> **Note**: Code examples use `from generator import DayhoffGenerator` when running from `assets/dayhoff-prototype/backend/`. For standalone scripts outside that directory, either add the backend directory to `sys.path` or copy `generator.py` + `constants.py` to your project.

## Choosing a Model Variant

Pass `model_name` to `DayhoffGenerator(...)` (default `170m-UR50-BRn` for fast iteration); set `load_all=True` and pass `model_key` to `generate_sequences` / `calculate_fitness_score` to switch variants in one process. Picker, capabilities matrix, and benchmarks live in [`about-dayhoff.md`](about-dayhoff.md#model-variants).

## API Reference

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `prompt` | str | `"M"` | Starting sequence (e.g., `"M"`, `"MK"`). Empty string for random start. |
| `num_sequences` | int | `3` | 1–500 |
| `max_length` | int | `80` | 10–600 amino acids |
| `temperature` | float | `0.8` | 0.1–2.0; lower = more conservative |
| `generation_mode` | str | `"unconditional"` | `unconditional` \| `family_guided` \| `motif_scaffolding` (see below) |
| `direction` | str | `"n_to_c"` | `n_to_c` (standard) \| `c_to_n` (reverse) |

**`family_guided`** biases generation using a `homologs` FASTA. Requires a homolog-capable variant (`3b-GR-HM-c` or `3b-GR-HM`); the proxy auto-falls-back to `unconditional` if the selected model isn't homolog-capable, and auto-promotes `unconditional` → `family_guided` when homologs are supplied with a capable model (see `backend/app.py`).

**`motif_scaffolding`** treats the prompt as a motif to preserve while sampling surrounding scaffold residues. Strongest with `3b-GR-HM`.

## Use Case 1: Unconditional Variant Generation

**Scenario**: Generate diverse 60-residue scaffolds to seed wet-lab expression screening.

```python
"""Sample Dayhoff variants and capture per-token log-likelihood traces."""
from generator import DayhoffGenerator

generator = DayhoffGenerator()
raw_sequences = generator.generate_sequences(prompt="M", num_sequences=5, max_length=80, temperature=0.8)

scores = [generator.calculate_fitness_score(seq) for seq in raw_sequences]
payload = [{"sequence": seq, "fitness": score} for seq, score in zip(raw_sequences, scores)]

assert len(payload) == 5
print(payload[0])
```

**Expected Output**: Dictionary containing a Dayhoff sequence and a preliminary 0–100 fitness hint.  
**Real-World Impact**: Provides a triaged batch of candidates for expression or directed evolution (source: prototype README).

### Scale it up: batch sampling with metrics

For multi-batch sweeps, tabulate with pandas:

```python
"""Batch generation with pandas logging for downstream analytics."""
from generator import DayhoffGenerator
import pandas as pd

generator = DayhoffGenerator()

def batch_sample(prompt, batches=2, per_batch=10):
    records = []
    for _ in range(batches):
        seqs = generator.generate_sequences(prompt=prompt, num_sequences=per_batch, max_length=120)
        for seq in seqs:
            records.append({
                "prompt": prompt,
                "sequence": seq,
                "score": generator.calculate_fitness_score(seq),
                "length": len(seq),
            })
    return pd.DataFrame(records)

df = batch_sample("M", batches=1, per_batch=5)
assert (df["length"] >= 10).all()
```

---

## Use Case 2: Zero-Shot Mutation Prioritization

**Scenario**: Rank single-point variants relative to a wild-type enzyme before allocating assay time.

```python
"""Score wild-type vs. single mutants and compute delta likelihood."""
from generator import DayhoffGenerator

generator = DayhoffGenerator()
wild_type = "MVKLALVGAGAAVALAQAADEGLNPDEVGGEALGRLLLVYPWTQRFFESFGDLSTPD"
mutants = [
    "MVKLALVGAGAAVALAQAADEGLNPDEVGGEALGRLLLVYPWTQRFFESFGDLSTPE",
    "MVKLALVGAGAAVALAQAADEGLNPDEIGGEALGRLLLVYPWTQRFFESFGDLSTPD",
    "MVKLALVGAGAAVALAQAADEGLNPDEVGGEALGRLLLVYPWTQRFFESFGDLSTPA",
]

baseline = generator.calculate_fitness_score(wild_type)
ranked = []
for seq in mutants:
    score = generator.calculate_fitness_score(seq)
    ranked.append({"sequence": seq, "delta_score": score - baseline})

ranked.sort(key=lambda item: item["delta_score"], reverse=True)
assert len(ranked) == 3
print(ranked[0])
```

**Expected Output**: Top-ranked mutation with positive delta score signaling higher model-assessed viability.  
**Real-World Impact**: Speeds choice of variants for wet-lab validation (source: research preprint).

---

## Use Case 3: Export for Downstream Tools

**Scenario**: Export Dayhoff sequences in standard formats for structure prediction, alignment, or wet-lab planning.

> Use the bundled `exporters.py` factory (`get_exporter("fasta" | "csv" | "json" | "txt")`) — it stamps every export with model, prompt, temperature, and a research-prototype disclaimer. Hand-rolling FASTA writes loses that provenance.

```python
"""Export validated sequences to FASTA and JSON formats using the bundled exporter."""
from generator import DayhoffGenerator
from exporters import get_exporter
from pathlib import Path

generator = DayhoffGenerator()
sequences = generator.generate_sequences(prompt="MK", num_sequences=3, max_length=70)
validation = generator.validate_sequences(sequences)

# `exporters.py` expects list[dict] with at least `sequence` (and optionally `fitness_score`).
records = [
    {"sequence": seq, "fitness_score": generator.calculate_fitness_score(seq)}
    for seq in validation["valid_sequences"]
]
params = {
    "model": "Dayhoff-170m-GR",
    "prompt": "MK",
    "temperature": 0.8,
    "max_length": 70,
    "generation_mode": "unconditional",
    "direction": "n_to_c",
}

fasta_exporter = get_exporter("fasta")
Path(fasta_exporter.get_filename()).write_text(fasta_exporter.export(records, params))

json_exporter = get_exporter("json")
Path(json_exporter.get_filename()).write_text(json_exporter.export(records, params))

print(f"Exported {len(records)} sequences as FASTA + JSON")
```

**Expected Output**: FASTA and JSON files with embedded provenance metadata, ready for downstream structure prediction, alignment tools, or database submission.  
**Real-World Impact**: Standardized export with disclaimers preserved enables seamless integration with AlphaFold, ESMFold, BLAST, or custom pipelines without losing model/parameter context.

> **Tip:** A small starter input set lives at [`../assets/dayhoff-prototype/examples/example_sequences.json`](../assets/dayhoff-prototype/examples/example_sequences.json) — useful as a fitness-scoring fixture or as inputs to the `family_guided` / `motif_scaffolding` modes.

> **Note**: See [troubleshooting.md](troubleshooting.md) if you encounter model loading issues.

---

## Use Case 4: Motif Scaffolding

Use the dedicated `motif_scaffolding` generation mode with a motif-capable variant (`3b-GR-HM` is the strongest on RFDiffusion / MotifBench — see [`about-dayhoff.md`](about-dayhoff.md#benchmark-results)). The mode tells the model to treat the prompt as a motif to preserve while sampling surrounding scaffold residues.

```python
"""Scaffold a known motif using the motif_scaffolding generation mode."""
from generator import DayhoffGenerator

generator = DayhoffGenerator(model_name="3b-GR-HM")
motif = "HIS"
outputs = generator.generate_sequences(
    prompt=f"MVR{motif}",
    num_sequences=5,
    max_length=90,
    temperature=0.7,
    generation_mode="motif_scaffolding",
)

# Light post-hoc check that the motif survived sampling.
preserved = [seq for seq in outputs if motif in seq]
assert len(preserved) >= 1
print(preserved[0])
```

> The post-hoc `in` check is a sanity guard, not a guarantee — `motif_scaffolding` biases sampling toward preservation but does not lock the motif. For strict preservation, oversample and filter.

---

## Performance

For GPU sizing, batching, half-precision tips, multi-variant memory budgets, and scale-out, see [`performance-guide.md`](performance-guide.md).

## Integration with Structure Prediction Tools

Generate, export to FASTA with provenance, hand off to AlphaFold / ESMFold / your structure pipeline:

```python
"""Prepare sequences for AlphaFold, ESMFold, or other structure predictors."""
from generator import DayhoffGenerator
from exporters import get_exporter
from pathlib import Path

generator = DayhoffGenerator()
sequences = generator.generate_sequences(prompt="MK", num_sequences=5, max_length=100)

records = [{"sequence": seq, "fitness_score": 0.0} for seq in sequences]
params = {"model": "Dayhoff-170m-GR", "prompt": "MK"}

fasta_exporter = get_exporter("fasta")
fasta_path = Path("for_structure_prediction.fasta")
fasta_path.write_text(fasta_exporter.export(records, params))

print(f"Ready for structure prediction: {fasta_path}")
```

The bundled reference app wires this end-to-end via the `backend/fold/` ESMFold server — see [`prototype-expansion.md`](prototype-expansion.md) for deploying it.

## Extending the Reference App

For guidance on expanding the reference prototype with custom features like additional API endpoints, batch processing, database integration, or validation pipelines, see [`prototype-expansion.md`](prototype-expansion.md).
