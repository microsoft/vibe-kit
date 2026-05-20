# Application Patterns

Code examples for common BioEmu workflows using the local `bioemu` Python package.

## Output Files

Every successful sample run writes three files to `--output_dir`:

| File | Format | Description |
|------|--------|-------------|
| `topology.pdb` | PDB | 3D structure (first frame) — also serves as the topology for the trajectory |
| `samples.xtc` | XTC | Trajectory containing all generated conformations |
| `sequence.fasta` | FASTA | Input sequence |

## Generate an Ensemble (Python API)

```python
from bioemu.sample import main as sample

sample(
    sequence="NLYIQWLKDGGPSSGRPPPS",
    num_samples=50,
    output_dir="~/trpcage",
)
```

Equivalent to:

```bash
python -m bioemu.sample --sequence NLYIQWLKDGGPSSGRPPPS --num_samples 50 --output_dir ~/trpcage
```

You can also pass an A3M file path as `sequence` to use your own MSA instead of the default ColabFold MMseqs2 lookup.

## Load Trajectory with MDTraj

```python
import mdtraj as md

traj = md.load("~/trpcage/samples.xtc", top="~/trpcage/topology.pdb")

print(f"Frames:   {traj.n_frames}")
print(f"Residues: {traj.n_residues}")
print(f"Atoms:    {traj.n_atoms}")
```

## Analyze Trajectory

```python
import mdtraj as md
import numpy as np

traj = md.load("~/trpcage/samples.xtc", top="~/trpcage/topology.pdb")

# Radius of gyration (Angstroms)
rg = md.compute_rg(traj) * 10

# Per-residue flexibility (RMSF, Angstroms)
ca = traj.top.select("name CA")
rmsf = md.rmsf(traj, traj, atom_indices=ca) * 10

# Secondary structure (DSSP)
dssp = md.compute_dssp(traj)
helix_fraction = np.mean(dssp == "H")
```

## Compare with AlphaFold

```python
import mdtraj as md

ensemble = md.load("~/trpcage/samples.xtc", top="~/trpcage/topology.pdb")
reference = md.load("alphafold.pdb")

ca = ensemble.top.select("name CA")
ensemble.superpose(reference, atom_indices=ca)
rmsd = md.rmsd(ensemble, reference, atom_indices=ca) * 10  # Angstroms
```

## Steering for Physical Realism

BioEmu's steering system (Sequential Monte Carlo with potential-energy guidance) reduces unphysical samples (steric clashes, chain breaks). Enable via `denoiser_config`:

```python
from bioemu.sample import main as sample

sample(
    sequence="NLYIQWLKDGGPSSGRPPPS",
    num_samples=100,
    output_dir="~/trpcage-steered",
    denoiser_config="src/bioemu/config/steering/physical_steering.yaml",
)
```

See the upstream [BioEmu README](https://github.com/microsoft/bioemu) for tunable parameters (`num_particles`, `ess_threshold`, etc.).

## Side-Chain Reconstruction and MD Relaxation

BioEmu outputs backbone frames only. To add side chains and (optionally) run a short MD equilibration:

```bash
pip install bioemu[md]
python -m bioemu.sidechain_relax \
    --pdb-path ~/trpcage/topology.pdb \
    --xtc-path ~/trpcage/samples.xtc
```

Outputs `samples_sidechain_rec.{pdb,xtc}` (and `samples_md_equil.{pdb,xtc}` if MD is enabled). Side-chain reconstruction depends on [HPacker](https://github.com/gvisani/hpacker), which requires `conda` on `PATH`.

## Reference App API (Path B)

If you're driving the reference app's proxy backend (`server/app.py`) over HTTP — for example from a custom client instead of the bundled React UI:

```python
import requests
import base64

response = requests.post(
    "http://localhost:5000/api/predict",
    json={"sequence": "NLYIQWLKDGGPSSGRPPPS", "numSamples": 50},
    timeout=900,
)
result = response.json()

pdb_bytes = base64.b64decode(result["results"]["topology.pdb"])
xtc_bytes = base64.b64decode(result["results"]["samples.xtc"])

with open("topology.pdb", "wb") as f:
    f.write(pdb_bytes)
with open("samples.xtc", "wb") as f:
    f.write(xtc_bytes)
```

Available proxy endpoints:

| Endpoint | Method | Description |
|---|---|---|
| `/api/predict` | POST | Generate ensemble from sequence |
| `/api/predict-uniprot` | POST | Same, accepting a UniProt ID |
| `/api/analyze-trajectory` | POST | MDTraj analysis on base64 PDB+XTC |
| `/api/energy-landscape` | POST | PCA-based free energy surface |
| `/api/status` | GET | Backend status (currently always returns `connected` — verify by running an actual prediction) |
