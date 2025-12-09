# Azure AI Foundry Setup

Deploy BioEmu as a serverless endpoint on Azure AI Foundry.

## Prerequisites

- Azure subscription with access to Azure AI Foundry
- Sufficient quota for serverless model deployments

## Step-by-Step Deployment

### 1. Navigate to BioEmu

Go to [Azure AI Foundry - BioEmu](https://ai.azure.com/explore/models/BioEmu)

### 2. Click Deploy

Select **Deploy** → **Serverless API**

### 3. Configure Deployment

| Setting | Recommendation |
|---------|----------------|
| Deployment name | `bioemu` (or your preference) |
| Region | Choose one close to you with available quota |
| Pricing tier | Pay-as-you-go (serverless) |

### 4. Wait for Deployment

Deployment typically takes 2-5 minutes. Status will change from "Creating" to "Succeeded."

### 5. Get Credentials

Once deployed, click on your deployment to find:

- **Endpoint URL** — Copy the full URL (ends with `/score`)
- **API Key** — Click "Show" to reveal, then copy

### 6. Configure the Reference App

Add these to your `.env` file:

```dotenv
BIOEMU_MODE=azure
AZURE_BIOEMU_ENDPOINT=https://your-deployment-name.region.inference.ml.azure.com/score
AZURE_BIOEMU_KEY=your_api_key_here
```

## Verify Connection

Start the backend and check the status:

```bash
curl http://localhost:5000/api/status
```

Expected response:
```json
{"mode": "azure", "status": "connected"}
```

## Pricing

BioEmu on Azure AI Foundry uses pay-as-you-go pricing. Costs depend on:
- Number of samples generated
- Sequence length
- Region

Check [Azure AI Foundry pricing](https://azure.microsoft.com/en-us/pricing/details/machine-learning/) for current rates.

## Troubleshooting

**401 Unauthorized:**
- Verify API key is correct
- Check key hasn't expired
- Ensure endpoint URL ends with `/score`

**Quota errors:**
- Request quota increase in Azure portal
- Try a different region

**Deployment stuck:**
- Cancel and retry
- Check Azure service health

See [troubleshooting.md](troubleshooting.md) for more common issues.
