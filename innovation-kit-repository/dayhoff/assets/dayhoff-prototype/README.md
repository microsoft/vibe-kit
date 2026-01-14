# Dayhoff Protein Sequence Generator Prototype

> **WARNING: RESEARCH PROTOTYPE - PREVIEW RELEASE**  
> This is an early-stage research prototype for generating synthetic protein sequences using Microsoft's Dayhoff-170m-GR model. Not intended for production use or clinical applications. Generated sequences and fitness scores should be validated experimentally before use in any protein engineering projects.

> **PRIVACY & SECURITY NOTICE**  
> **DO NOT enter sensitive, proprietary, confidential, or personal information into this tool.**  
> - Do not input unpublished research sequences, trade secrets, or proprietary protein designs  
> - Do not enter patient data, personal health information, or any identifying information  
> - All inputs are processed locally, but treat this as a public research tool

## Overview

A standalone web application for generating novel protein sequences using a **locally-running Dayhoff language model**. This prototype downloads and runs the [Dayhoff-170m-GR](https://huggingface.co/microsoft/Dayhoff-170m-GR) model on your machine—no cloud API calls required. Generate sequences with minimal prompts, get zero-shot fitness predictions, and export sequences for further analysis.

**Dayhoff Models on Hugging Face:**

| Model | Size | Best For |
|-------|------|----------|
| [Dayhoff-170m-GR](https://huggingface.co/microsoft/Dayhoff-170m-GR) | 170M | Default, CPU-friendly |
| [Dayhoff-170m-UR50](https://huggingface.co/microsoft/Dayhoff-170m-UR50) | 170M | UniRef50 trained |
| [Dayhoff-170m-UR90](https://huggingface.co/microsoft/Dayhoff-170m-UR90) | 170M | UniRef90 trained |
| [Dayhoff-3b-GR-HM-c](https://huggingface.co/microsoft/Dayhoff-3b-GR-HM-c) | 3B | Higher quality, GPU required |
| [Dayhoff-3b-GR-HM](https://huggingface.co/microsoft/Dayhoff-3b-GR-HM) | 3B | GPU required |
| [Dayhoff-3b-UR90](https://huggingface.co/microsoft/Dayhoff-3b-UR90) | 3B | UniRef90, GPU required |

See [all Dayhoff models](https://huggingface.co/models?search=microsoft/Dayhoff) on Hugging Face.

## What is Dayhoff?

Dayhoff is a protein language model trained on evolutionary relationships. It can generate novel, biologically plausible amino acid sequences based on minimal input prompts.

- **Model**: microsoft/Dayhoff-170m-GR (170M parameters)
- **Input**: Partial amino acid sequences (e.g., "M", "MK", "GAVL") or empty string
- **Output**: Complete protein sequences (20-600 amino acids) with fitness predictions
- **Deployment**: Runs locally on CPU or GPU (model downloaded on first run, ~700MB)
- **Use Case**: Synthetic biology, protein design, evolutionary studies, sequence generation for downstream analysis

## Zero-Shot Fitness Prediction

The prototype includes **experimental zero-shot fitness scoring** using Dayhoff's internal likelihood calculations:

- **Fitness Scores**: 0-100 scale (higher = more likely to be functional)
- **Color Coding**: Green (70+), Yellow (40-69), Red (less than 40)
- **Methodology**: Uses Dayhoff model's sequence likelihood as fitness proxy
- **No Additional APIs**: Computed entirely using the loaded Dayhoff model
- **Based on**: Methodology published by Dayhoff team: https://www.biorxiv.org/content/10.1101/2025.07.21.665991v1

**Important Limitations:**
- Scores are computational predictions only - not validated against experimental data
- Should be used for initial ranking/filtering, not as definitive fitness measures
- Requires wet-lab validation for any protein engineering applications

## Project Structure

```
dayhoff-prototype/
├── backend/                    # Flask API server
│   ├── app.py                  # Flask app factory and routes
│   ├── generator.py            # DayhoffGenerator class
│   ├── exporters.py            # FASTA/CSV/JSON/TXT export handlers
│   ├── constants.py            # GenerationMode, Direction, config
│   ├── cli.py                  # Command-line interface
│   ├── test_dayhoff.py         # Model loading and generation tests
│   ├── test_fitness.py         # Fitness scoring validation
│   └── requirements.txt        # Python dependencies
├── frontend/                   # Vite + React + TypeScript UI
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── App.tsx             # Main application
│   │   ├── api.ts              # API client functions
│   │   └── types.ts            # TypeScript interfaces
│   ├── package.json            # Node.js dependencies
│   └── vite.config.ts          # Vite configuration (proxies to backend)
└── README.md
```

## Quick Start

### 1. Install Backend Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Install Frontend Dependencies
```bash
cd frontend
npm install
```

### 3. Start Backend Server (Terminal 1)
```bash
cd backend
python app.py
```
Backend API runs at http://localhost:5001

### 4. Start Frontend Dev Server (Terminal 2)
```bash
cd frontend
npm run dev
```
Open http://localhost:5173 in your browser

### 5. Run Tests
```bash
cd backend
python test_dayhoff.py
python test_fitness.py
```

### 6. CLI Usage (Optional)
```bash
cd backend
python cli.py --prompt "MK" --num 5 --length 100 --fitness
```

## GPU Acceleration & Larger Models

### Using GPU (Recommended for Speed)

If you have an NVIDIA GPU with CUDA support, the model will automatically use it for significantly faster generation:

**Performance Comparison (3 sequences @ 600 amino acids):**
- **CPU**: ~4 minutes
- **GPU (consumer)**: ~30-60 seconds
- **GPU (datacenter)**: ~10-30 seconds

No code changes needed - PyTorch automatically detects and uses available GPUs.

### Upgrading to Larger Models

Users with sufficient GPU memory can use larger Dayhoff models for potentially better sequence quality:

**Available Models:**
- `microsoft/Dayhoff-170m-GR` (default) - 170M parameters, ~2GB VRAM
- `microsoft/Dayhoff-3b-GR-HM-c` - 3B parameters, ~12-16GB VRAM (requires GPU)

**To use the 3B model:**

1. Edit `backend/generator.py` line ~32:
```python
# Change from:
def __init__(self, model_name: str = DEFAULT_MODEL_NAME):

# To:
def __init__(self, model_name: str = "microsoft/Dayhoff-3b-GR-HM-c"):
```

2. (Optional) Add GPU optimizations at line 20-24:
```python
self.model = AutoModelForCausalLM.from_pretrained(
    model_name,
    trust_remote_code=True,
    torch_dtype=torch.float16,  # Half precision saves VRAM
    device_map="auto",           # Automatic GPU placement
    use_mamba_kernels=False
)
```

**GPU Requirements:**
- **Dayhoff-170M**: 2GB VRAM (runs on most GPUs)
- **Dayhoff-3B**: 12-16GB VRAM (RTX 3090, RTX 4090, A5000, A6000, A100)

**Note**: Larger models may produce higher quality sequences but are not guaranteed to be better for all use cases. The 170M model is sufficient for most research applications.

### Using Azure AI Foundry (Cloud Hosted)

Instead of running models locally, you can deploy Dayhoff to Azure AI Foundry for serverless inference. This provides:
- No local GPU required
- Pay-per-use pricing
- Scalable infrastructure

See the [Azure AI Foundry Deployment Guide](../../../../../docs/deployment/DEPLOYING-AZURE-AI-FOUNDRY-MODELS.md) for complete setup instructions.

**Quick start with Azure endpoint:**
```python
import os
import requests

endpoint = os.environ["DAYHOFF_ENDPOINT"]
api_key = os.environ["DAYHOFF_KEY"]

response = requests.post(
    endpoint,
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
    json={"prompt": "M", "num_sequences": 3, "max_length": 60},
    timeout=60,
)
print(response.json())
```

## Using with Structure Prediction Tools

Generated sequences can be exported for use with structure prediction and analysis tools:

1. **Generate sequences** with Dayhoff web app
2. **Export sequences** using built-in download buttons (FASTA, CSV, JSON, or TXT)
3. **Import into structure prediction tools** (BioEmu, AlphaFold, ESMFold, etc.)
4. **Analyze structures** using your preferred molecular dynamics tools

### Export Formats

The example site provides one-click export in multiple formats, all including fitness scores and generation parameters:

- **FASTA** - Standard bioinformatics format with metadata headers
- **CSV** - Spreadsheet-friendly with sequence ID, sequence, length, and fitness score
- **JSON** - Complete export with all metadata and parameters for reproducibility
- **TXT** - Human-readable format with detailed information

All exports include generation parameters (prompt, temperature, max length, mode, direction) to ensure reproducibility.

This standalone approach allows you to:
- Test different sequence generators independently
- Mix and match tools in your workflow
- Validate sequences before committing to expensive structure predictions
- Track and reproduce your generation experiments

## Example Usage

### Programmatic Usage

```python
from dayhoff_simple import DayhoffGenerator

# Initialize generator
generator = DayhoffGenerator()

# Generate sequences with fitness scoring
sequences = generator.generate_sequences(
    prompt="M",           # Starting amino acid(s) - can be any length (e.g., "M", "MK", "MKTAYIAKQRQ")
    num_sequences=5,      # Generate 5 variants
    max_length=80,        # Up to 600 amino acids supported
    temperature=0.8       # Creativity: higher = more diverse, lower = more conservative (0.1-2.0)
)

# Calculate fitness for each sequence
for seq in sequences:
    fitness = generator.calculate_fitness_score(seq)
    print(f"Sequence: {seq}")
    print(f"Fitness: {fitness:.1f}/100\n")
```

### Web Interface Usage

1. Start the backend: `cd backend && python app.py`
2. Start the frontend: `cd frontend && npm run dev`
3. Open http://localhost:5173
4. Enter a starting sequence (or leave empty)
5. Adjust parameters (length, temperature, count)
6. Click "Generate Sequences"
7. Copy individual sequences or download batch of sequences

## Disclaimer & Limitations

**This is a research prototype demonstrating computational protein design concepts. Key limitations:**

1. **Not Production-Ready**: Code is for demonstration and research purposes only
2. **No Clinical Use**: Not validated for clinical, diagnostic, or therapeutic applications
3. **Experimental Validation Required**: All generated sequences and fitness scores must be validated through wet-lab experiments before any practical use
4. **Performance**: Running on local hardware (CPU) will be significantly slower than GPU inference
5. **Sequence Quality**: Generated sequences are computationally plausible but may not fold or function as intended. Recommend further analysis with structure prediction tools
6. **Fitness Scores**: Computational predictions only - correlation with actual protein fitness not established for this implementation

**Potential Next Steps:**
- Validate fitness scoring against known protein datasets
- Benchmark against experimental expression/activity data
- Implement proper error handling and logging
- Add sequence caching and optimization
- Deploy on GPU infrastructure for production performance
- Integrate comprehensive testing and validation pipelines

## Support & Contributions

This prototype is shared for educational and research purposes. For questions or contributions, please open an issue in the repository.