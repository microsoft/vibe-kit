# Troubleshooting

## Check Status

```bash
curl http://localhost:5000/api/status
```

Expected: `{"mode": "azure", "status": "connected"}`

## Azure Credentials

**Where to get them:**
1. Go to [Azure AI Foundry - BioEmu](https://ai.azure.com/explore/models/BioEmu)
2. Deploy a serverless endpoint
3. Copy Endpoint URL and API Key

**401 Unauthorized:**
- Verify `AZURE_BIOEMU_KEY` is correct
- Check the key hasn't expired
- Ensure endpoint URL ends with `/score`

## Common Issues

### npm install fails

```bash
npm install --legacy-peer-deps
```

### "API not connected" in browser

Backend must return `status: "connected"`. Check your `.env` credentials.

### Missing Python packages

```bash
source venv/bin/activate
pip install -r requirements.txt
```

### MDTraj/DSSP errors

```bash
# Ubuntu/Debian
sudo apt-get install dssp

# macOS
brew install brewsci/bio/dssp
```

## Environment Variables

Required for Azure mode:
```bash
BIOEMU_MODE=azure
AZURE_BIOEMU_ENDPOINT=https://your-endpoint.inference.ml.azure.com/score
AZURE_BIOEMU_KEY=your_key
```

Optional (AI Copilot):
```bash
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=...
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o-mini
```

## Local Mode (Experimental)

Requirements:
- Linux only
- Python 3.10 or 3.11 (not 3.12)
- GPU strongly recommended

```bash
BIOEMU_MODE=local
pip install bioemu torch
```

First run downloads ~7GB of model files.
