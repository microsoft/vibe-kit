"""Test that different model keys produce different outputs from the scoring endpoint."""
import httpx
import json

PROMPT = "MDKKYSIGL"
MODELS = ["170m-UR50-BRn", "3b-UR90", "3b-GR-HM-c"]

for model in MODELS:
    r = httpx.post("http://localhost:8000/api/generate", json={
        "prompt": PROMPT,
        "num_sequences": 1,
        "max_length": 64,
        "temperature": 0.5,  # low temp for more deterministic comparison
        "generation_mode": "unconditional",
        "direction": "n_to_c",
        "model": model,
    }, timeout=120)
    d = r.json()
    stats = d.get("stats", {})
    seqs = d.get("sequences", [""])
    seq = seqs[0][:50] if seqs else "NONE"
    fitness = stats.get("avg_fitness", "N/A")
    reported = stats.get("model", "MISSING")
    print(f"{model}:")
    print(f"  reported_model={reported}  fitness={fitness}")
    print(f"  seq={seq}...")
    print()
