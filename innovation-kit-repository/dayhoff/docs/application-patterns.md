# Dayhoff Application Patterns

**Domain-specific workflows and proven protein design implementations.**

> **Note**: Code examples use `from generator import DayhoffGenerator` when running from `assets/dayhoff-prototype/backend/`. For standalone scripts, copy `generator.py` and `constants.py` to your project.

## API Reference

### Generation Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prompt` | string | `"M"` | Starting amino acid sequence (e.g., "M", "MK", "GAVL"). Empty string for random start. |
| `num_sequences` | int | `3` | Number of sequences to generate (1-500) |
| `max_length` | int | `80` | Maximum sequence length (10-600 amino acids) |
| `temperature` | float | `0.8` | Sampling temperature (0.1-2.0). Higher = more diverse, lower = more conservative |
| `generation_mode` | string | `"unconditional"` | Generation mode (see below) |
| `direction` | string | `"n_to_c"` | Generation direction (see below) |

### Generation Modes (`GenerationMode`)

| Value | Description |
|-------|-------------|
| `unconditional` | Generate sequences without constraints. Best for exploring sequence diversity. |
| `family_guided` | Guide generation toward specific protein family characteristics. |
| `motif_scaffolding` | Generate scaffolds around conserved motifs. |

### Generation Directions (`Direction`)

| Value | Description |
|-------|-------------|
| `n_to_c` | N-terminus to C-terminus (standard biological direction) |
| `c_to_n` | C-terminus to N-terminus (reverse direction for specific use cases) |

## Primary Use Cases

### Use Case 1: Unconditional Variant Generation

**Scenario**: Generate diverse 60-residue scaffolds to seed wet-lab expression screening.

```python
"""Sample Dayhoff variants and capture per-token log-likelihood traces."""
from dayhoff_simple import DayhoffGenerator
import torch

generator = DayhoffGenerator()
raw_sequences = generator.generate_sequences(prompt="M", num_sequences=5, max_length=80, temperature=0.8)

scores = [generator.calculate_fitness_score(seq) for seq in raw_sequences]
payload = [{"sequence": seq, "fitness": score} for seq, score in zip(raw_sequences, scores)]

assert len(payload) == 5
print(payload[0])
```

**Expected Output**: Dictionary containing a Dayhoff sequence and a preliminary 0–100 fitness hint.  
**Real-World Impact**: Provides a triaged batch of candidates for expression or directed evolution (source: prototype README).

---

### Use Case 2: Zero-Shot Mutation Prioritization

**Scenario**: Rank single-point variants relative to a wild-type enzyme before allocating assay time.

```python
"""Score wild-type vs. single mutants and compute delta likelihood."""
from dayhoff_simple import DayhoffGenerator

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

### Use Case 3: Export for Downstream Tools

**Scenario**: Export Dayhoff sequences in standard formats for structure prediction, alignment, or wet-lab planning.

```python
"""Export validated sequences to FASTA and JSON formats."""
from dayhoff_simple import DayhoffGenerator
import json
from pathlib import Path

generator = DayhoffGenerator()
sequences = generator.generate_sequences(prompt="MK", num_sequences=3, max_length=70)
validation = generator.validate_sequences(sequences)

# Export to FASTA
fasta_path = Path("sequences.fasta")
with fasta_path.open("w") as f:
    for i, seq in enumerate(validation["valid_sequences"], 1):
        f.write(f">dayhoff_seq_{i}\n{seq}\n")

# Export to JSON with metadata
json_path = Path("sequences.json")
json.dump({
    "sequences": validation["valid_sequences"],
    "prompt": "MK",
    "model": "Dayhoff-170m-GR"
}, json_path.open("w"), indent=2)

print(f"Exported {len(validation['valid_sequences'])} sequences")
```

**Expected Output**: FASTA and JSON files ready for downstream structure prediction, alignment tools, or database submission.  
**Real-World Impact**: Standardized export enables seamless integration with AlphaFold, ESMFold, BLAST, or custom pipelines.

> **Note**: See [troubleshooting.md](troubleshooting.md) if you encounter model loading issues.

## Common Workflow Patterns

### **Pattern 1: Batch Sampling with Metrics**

```python
"""Batch generation with pandas logging for downstream analytics."""
from dayhoff_simple import DayhoffGenerator
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
    frame = pd.DataFrame(records)
    return frame

df = batch_sample("M", batches=1, per_batch=5)
assert (df["length"] >= 10).all()
```

### **Pattern 2: Motif Preservation**

```python
"""Ensure generated sequences retain a supplied motif substring."""
from dayhoff_simple import DayhoffGenerator

generator = DayhoffGenerator()
motif = "HIS"
outputs = generator.generate_sequences(prompt="MVRHIS", num_sequences=5, max_length=90, temperature=0.7)

filtered = [seq for seq in outputs if motif in seq]
assert len(filtered) >= 1
print(filtered[0])
```

## Results Interpretation

### **Understanding Dayhoff Outputs**

```python
"""Summarize likelihood hints and hydrophobic balance for design review."""
from collections import Counter

def interpret(sequence, fitness_score):
    counts = Counter(sequence)
    hydrophobic = sum(counts[aa] for aa in "GAVLIPFWM" if aa in counts)
    polar = sum(counts[aa] for aa in "STNQY" if aa in counts)
    return {
        "length": len(sequence),
        "fitness": round(fitness_score, 2),
        "hydrophobic_ratio": hydrophobic / max(len(sequence), 1),
        "polar_ratio": polar / max(len(sequence), 1),
    }

metrics = [interpret(seq, score) for seq, score in zip(raw_sequences, scores)]
print(metrics[0])
```

### **Quality Assessment**

```python
"""Assess sequence quality using heuristics prior to lab submission."""
def assess_quality(record):
    checks = [
        30 <= record["length"] <= 200,
        record["fitness"] >= 40,
        0.35 <= record["hydrophobic_ratio"] <= 0.65,
    ]
    return sum(checks) / len(checks)

quality_scores = [assess_quality(m) for m in metrics]
assert max(quality_scores) <= 1.0
```

## Performance Optimization

### **For Speed**

```python
"""Use half-precision sampling on GPU to boost throughput."""
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

tokenizer = AutoTokenizer.from_pretrained("microsoft/Dayhoff-170m-GR", trust_remote_code=True)
model = AutoModelForCausalLM.from_pretrained(
    "microsoft/Dayhoff-170m-GR",
    trust_remote_code=True,
    torch_dtype=torch.float16,
    device_map="auto",
    use_mamba_kernels=False,
)

inputs = tokenizer("M", return_tensors="pt").to(model.device)
outputs = model.generate(**inputs, max_length=100, num_return_sequences=8, do_sample=True)
```

### **For Accuracy**

```python
"""Lower temperature and increase repetition penalty for conservative sampling."""
from dayhoff_simple import DayhoffGenerator

generator = DayhoffGenerator()
stable = generator.generate_sequences(
    prompt="MKQL",
    num_sequences=3,
    max_length=80,
    temperature=0.6,
    generation_mode="family_guided",
)
print(stable)
```

### **For Scale**

```python
"""Distribute prompts across GPUs for high-throughput exploration."""
import concurrent.futures
from dayhoff_simple import DayhoffGenerator

def run_prompt(prompt):
    generator = DayhoffGenerator()
    return generator.generate_sequences(prompt=prompt, num_sequences=5, max_length=120)

prompts = ["M", "MK", "GAVL", "LLL"]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
    results = list(executor.map(run_prompt, prompts))

assert len(results) == len(prompts)
```

## Integration Examples

### **With Structure Prediction Tools**

```python
"""Prepare sequences for AlphaFold, ESMFold, or other structure predictors."""
from dayhoff_simple import DayhoffGenerator
from pathlib import Path

generator = DayhoffGenerator()
sequences = generator.generate_sequences(prompt="MK", num_sequences=5, max_length=100)

# Export for AlphaFold/ESMFold
fasta_path = Path("for_structure_prediction.fasta")
with fasta_path.open("w") as f:
    for i, seq in enumerate(sequences, 1):
        f.write(f">dayhoff_candidate_{i}\n{seq}\n")

print(f"Ready for structure prediction: {fasta_path}")
```

### **With Azure ML Pipelines**

```python
"""Store Dayhoff outputs in Azure Blob Storage for downstream ML orchestration."""
from azure.storage.blob import BlobServiceClient
import json
import os

sequencing = json.dumps(payload).encode("utf-8")
service = BlobServiceClient.from_connection_string(os.environ["AZURE_STORAGE_CONNECTION_STRING"])
container = service.get_container_client("dayhoff-sequences")
container.upload_blob(name="batch-001.json", data=sequencing, overwrite=True)
```

---

## Extending the Reference App

For guidance on expanding the reference prototype with custom features like additional API endpoints, batch processing, database integration, or validation pipelines, see [prototype-expansion.md](prototype-expansion.md).