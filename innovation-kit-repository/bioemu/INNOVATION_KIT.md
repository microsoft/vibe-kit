# BioEmu Innovation Kit

Generate and analyze protein conformational ensembles (the range of 3D shapes a protein adopts) using AI.

## What's Included

- **Reference App**: React + Flask application with 3D visualization
- **Azure Integration**: BioEmu endpoint for fast inference
- **Analysis Tools**: MDTraj-based trajectory metrics (analysis of protein motion over time)
- **AI Copilot**: Research assistant (optional)

## Quick Start

### Backend

```bash
cd assets/reference-app/server
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # Add your Azure credentials
python app.py
```

**Note**: Dependency installation may take several minutes depending on your hardware and network connection.

### Frontend (new terminal)

```bash
cd assets/reference-app
npm install --legacy-peer-deps
npm start
```

**Note**: The first `npm install` and initial compilation may take several minutes. Subsequent starts are faster.

Open http://localhost:3000

## Documentation

- [Quick Start](docs/quick-start.md) — Setup and first run
- [Application Patterns](docs/application-patterns.md) — Code examples
- [Troubleshooting](docs/troubleshooting.md) — Common issues

## Resources

- [BioEmu on GitHub](https://github.com/microsoft/bioemu)
- [BioEmu on Azure AI Foundry](https://ai.azure.com/explore/models/BioEmu)

## Learn More

- [Blog: Exploring structural changes driving protein function](https://www.microsoft.com/en-us/research/blog/exploring-the-structural-changes-driving-protein-function-with-bioemu-1/) — Overview of BioEmu's capabilities and scientific motivation
- [Video: BioEmu overview (5 min)](https://www.microsoft.com/en-us/research/video/scalable-emulation-of-protein-equilibrium-ensembles-with-bioemu/) — Quick introduction to the model
- [Video: BioEmu deep dive](https://www.microsoft.com/en-us/research/video/scalable-emulation-of-protein-equilibrium-ensembles-with-bioemu-2/) — Technical details and research context
