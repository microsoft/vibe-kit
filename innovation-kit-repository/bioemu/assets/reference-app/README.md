# BioEmu Reference Application

Interactive web app for protein conformational ensemble analysis using Microsoft's BioEmu model.

## Features

- **3D Visualization**: [Molstar](https://molstar.org/) viewer with trajectory playback
- **Ensemble Analysis**: [RMSD](https://en.wikipedia.org/wiki/Root-mean-square_deviation_of_atomic_positions), [RMSF](https://en.wikipedia.org/wiki/Root_mean_square_fluctuation), radius of gyration, secondary structure
- **Structure Comparison**: Compare with AlphaFold or custom PDB references
- **PCA Analysis**: Conformational landscape visualization
- **Data Export**: Download PDB, XTC, and analysis results

---

## Project Structure

```
reference-app/
├── src/                          # React frontend
│   ├── App.js                    # Main application component
│   ├── components/               # UI components
│   │   ├── ProteinAnalysisPage.js    # Main analysis page
│   │   ├── ConformationalExplorer.js # PCA and conformational analysis
│   │   ├── MolstarViewerEnhanced.js  # 3D protein visualization
│   │   ├── MolstarViewerDualStructure.js  # Side-by-side comparison
│   │   ├── MolstarViewerTrajectoryControl.js # Trajectory playback
│   │   ├── RMSDVisualization.js      # RMSD/RMSF charts
│   │   ├── SecondaryStructureVisualization.js
│   │   ├── ContactMapVisualization.js
│   │   ├── UnifiedSequenceInput.js   # Sequence/PDB input
│   │   ├── StableInputs.js           # Isolated input components
│   │   ├── PDBInput.js               # PDB ID lookup
│   │   └── copilot/                  # AI copilot components
│   ├── services/                 # API and data services
│   │   ├── BioEmuService.js          # BioEmu API client
│   │   ├── BioEmuCache.js            # Response caching
│   │   ├── BioEmuContextService.js   # Copilot context provider
│   │   ├── ContextIntegration.js     # Context state management
│   │   ├── PDBService.js             # PDB/UniProt lookups
│   │   ├── ReferenceStructureService.js
│   │   └── ConfigService.js          # Environment config
│   └── utils/                    # Helper utilities
├── server/                       # Flask backend
│   ├── app.py                    # Main Flask app (imports route blueprints)
│   ├── config.py                 # Environment config, constants
│   ├── logging_utils.py          # BioEmu logging helpers
│   ├── superposition_utils.py    # Sequence alignment superposition
│   ├── routes/                   # API route blueprints
│   │   ├── health.py                 # /health, /api/status, /api/config
│   │   ├── prediction.py             # /api/predict, /api/predict-uniprot
│   │   ├── pdb.py                    # /api/pdb-sequence, /api/pdb-info
│   │   ├── uniprot.py                # /api/uniprot-info
│   │   ├── alphafold.py              # /api/alphafold-structure
│   │   ├── trajectory.py             # /api/analyze-trajectory
│   │   ├── superposition.py          # /api/superpose-structures
│   │   ├── comparison.py             # /api/analyze-reference-structure
│   │   ├── copilot.py                # /api/copilot/ask
│   │   └── frontend.py               # Static file serving
│   ├── prompts/                  # AI copilot prompt templates
│   ├── trajectory_analysis.py    # MDTraj analysis functions
│   ├── reference_structure_analysis.py # Reference comparison
│   ├── energy_landscape_analysis.py   # Energy landscape calculations
│   ├── pdb_service.py            # PDB integration
│   ├── uniprot_service.py        # UniProt integration
│   ├── copilot_service.py        # AI copilot backend
│   ├── local_bioemu.py           # Local GPU inference (optional)
│   ├── requirements.txt          # Python dependencies
│   └── .env.example              # Environment template
├── public/                       # Static assets
├── package.json                  # Node.js dependencies
└── tailwind.config.js            # Tailwind CSS config
```

---

## Quick Start

### 1. Backend

```bash
cd server
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # Edit with your Azure credentials
python app.py
```

**Note**: Dependency installation may take several minutes depending on your hardware and network connection.

### 2. Frontend

In a separate terminal:

```bash
npm install --legacy-peer-deps
npm start
```

**Note**: The first `npm install` and initial compilation may take several minutes. Subsequent starts are faster.

Open http://localhost:3000

---

## Configuration

Edit `server/.env`:

```bash
# Required
BIOEMU_MODE=azure
AZURE_BIOEMU_ENDPOINT=https://your-endpoint.inference.ml.azure.com/score
AZURE_BIOEMU_KEY=your_api_key

# Optional (AI Copilot)
AZURE_OPENAI_API_KEY=your_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o-mini
```

**Get credentials**: [Azure AI Foundry - BioEmu](https://ai.azure.com/explore/models/BioEmu)

## Example Proteins

| Protein | Sequence | Residues |
|---------|----------|----------|
| Trp-cage | `NLYIQWLKDGGPSSGRPPPS` | 20 |
| Villin HP35 | `LSDEDFKAVFGMTRSAFANLPLWKQQNLKKEKGLF` | 35 |

## Tech Stack

- **Frontend**: React, Molstar, Recharts, Tailwind CSS
- **Backend**: Flask, MDTraj, BioPython
- **API**: Azure BioEmu endpoint

---

## Key Components

### Frontend Components (`src/components/`)

| Component | Purpose |
|-----------|---------|
| `ProteinAnalysisPage.js` | Main page orchestrating all analysis views |
| `ConformationalExplorer.js` | PCA visualization of conformational landscape |
| `MolstarViewerEnhanced.js` | 3D structure viewer with basic controls |
| `MolstarViewerDualStructure.js` | Side-by-side structure comparison |
| `MolstarViewerTrajectoryControl.js` | Trajectory playback with frame sync |
| `RMSDVisualization.js` | RMSD/RMSF analysis charts |
| `SecondaryStructureVisualization.js` | Secondary structure timeline |
| `ContactMapVisualization.js` | Residue contact maps |
| `UnifiedSequenceInput.js` | Sequence input with validation |
| `StableInputs.js` | Isolated input components (prevents re-renders) |
| `PDBInput.js` | PDB ID lookup and chain selection |

### Backend Services (`server/`)

| File | Purpose |
|------|---------|
| `app.py` | Flask app entry point (imports route blueprints) |
| `routes/` | Modular API route blueprints |
| `trajectory_analysis.py` | MDTraj-based structure analysis |
| `reference_structure_analysis.py` | Reference structure comparison |
| `energy_landscape_analysis.py` | Energy landscape calculations |
| `pdb_service.py` | PDB data fetching |
| `uniprot_service.py` | UniProt data fetching |
| `copilot_service.py` | Azure OpenAI / GitHub Models integration |
| `prompts/` | AI copilot prompt templates |
| `local_bioemu.py` | Local GPU inference (Linux only) |

### Frontend Services (`src/services/`)

| Service | Purpose |
|---------|---------|
| `BioEmuService.js` | API client for ensemble generation |
| `BioEmuCache.js` | Response caching for performance |
| `BioEmuContextService.js` | Copilot context provider |
| `ContextIntegration.js` | Context state management |
| `PDBService.js` | PDB/UniProt data fetching |
| `ReferenceStructureService.js` | AlphaFold structure integration |
| `ConfigService.js` | Environment and config management |

---

## Customization

To modify the reference app:

1. **Add new analysis**: Create a component in `src/components/`, add to `ProteinAnalysisPage.js`
2. **New API endpoint**: Add route in `server/app.py`, analysis in `trajectory_analysis.py`
3. **Styling**: Edit `tailwind.config.js` or component-level styles

---

## Troubleshooting

See [troubleshooting.md](../../docs/troubleshooting.md)
