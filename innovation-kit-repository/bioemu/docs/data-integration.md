# Data Integration

API formats and file structures for BioEmu.

## API Response Format

### POST /api/predict

**Request:**
```json
{
  "sequence": "NLYIQWLKDGGPSSGRPPPS",
  "numSamples": 100
}
```

**Response:**
```json
{
  "status": "success",
  "results": {
    "topology.pdb": "<base64-encoded>",
    "samples.xtc": "<base64-encoded>",
    "sequence.fasta": "<base64-encoded>"
  }
}
```

### GET /api/status

**Response:**
```json
{
  "mode": "azure",
  "status": "connected",
  "message": "Azure BioEmu endpoint configured"
}
```

## Output Files

| File | Format | Description |
|------|--------|-------------|
| `topology.pdb` | PDB | 3D structure (first frame) |
| `samples.xtc` | XTC | Trajectory with all conformations |
| `sequence.fasta` | FASTA | Input sequence |

## Decoding Base64 Responses

**JavaScript:**
```javascript
const pdbBytes = atob(response.results["topology.pdb"]);
const blob = new Blob([pdbBytes], { type: "chemical/x-pdb" });
```

**Python:**
```python
import base64

pdb_data = base64.b64decode(result["results"]["topology.pdb"])
with open("topology.pdb", "wb") as f:
    f.write(pdb_data)
```

## Loading Files with MDTraj

```python
import mdtraj as md

# Load trajectory (requires both files)
traj = md.load("samples.xtc", top="topology.pdb")

print(f"Frames: {traj.n_frames}")
print(f"Residues: {traj.n_residues}")
print(f"Atoms: {traj.n_atoms}")
```
