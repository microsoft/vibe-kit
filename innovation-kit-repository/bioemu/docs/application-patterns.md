# Application Patterns

Code examples for common BioEmu workflows.

## Generate Ensemble via API

```python
import requests
import base64

response = requests.post(
    "http://localhost:5000/api/predict",
    json={"sequence": "NLYIQWLKDGGPSSGRPPPS", "numSamples": 50}
)
result = response.json()

# Decode output files
pdb_data = base64.b64decode(result["results"]["topology.pdb"])
xtc_data = base64.b64decode(result["results"]["samples.xtc"])
```

## Analyze Trajectory with MDTraj

```python
import mdtraj as md
import numpy as np

traj = md.load("samples.xtc", top="topology.pdb")

# Radius of gyration
rg = md.compute_rg(traj) * 10  # Angstroms

# Per-residue flexibility (RMSF)
rmsf = md.rmsf(traj, traj, atom_indices=traj.top.select("name CA")) * 10

# Secondary structure
dssp = md.compute_dssp(traj)
helix_fraction = np.mean(dssp == 'H')
```

## Compare with AlphaFold

```python
import mdtraj as md

ensemble = md.load("samples.xtc", top="topology.pdb")
reference = md.load("alphafold.pdb")

ca = ensemble.top.select("name CA")
ensemble.superpose(reference, atom_indices=ca)
rmsd = md.rmsd(ensemble, reference, atom_indices=ca) * 10  # Angstroms
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/predict` | POST | Generate ensemble |
| `/api/status` | GET | Check configuration |
| `/api/analyze-trajectory` | POST | Analyze PDB/XTC |

## Output Files

- **topology.pdb**: Structure file for visualization
- **samples.xtc**: Trajectory with all conformations
- **sequence.fasta**: Input sequence
