# Prototype Expansion Guide

The reference app (`assets/dayhoff-prototype/`) provides a solid foundation for rapid prototyping with a Flask backend and React frontend. This guide covers common expansion patterns.

## Architecture Overview

The prototype follows SOLID principles with clear separation:

```
dayhoff-prototype/
├── backend/                    # Flask API server (port 5001)
│   ├── app.py                  # App factory and routes
│   ├── generator.py            # DayhoffGenerator class
│   ├── exporters.py            # Export handlers (factory pattern)
│   ├── constants.py            # GenerationMode, Direction, config
│   └── cli.py                  # Command-line interface
└── frontend/                   # Vite + React + TypeScript (port 5173)
    └── src/
        ├── components/         # React components
        ├── api.ts              # API client
        └── types.ts            # TypeScript interfaces
```

## When to Expand the Reference App

**Keep the reference app as-is if:**
- You need interactive generation with immediate visual feedback
- Your workflow fits: prompt -> generate -> export -> external tools
- You're prototyping with less than 100 sequences per session
- You want a turnkey demo for stakeholders

**Extend the reference app when:**
- You need batch processing of many prompts
- You want custom scoring beyond log-likelihood (e.g., domain-specific filters)
- You need additional API endpoints for programmatic access
- You want to integrate real-time validation or database storage
- You need to add authentication or multi-user support

## Pattern 1: Add New API Endpoints

The backend already has REST endpoints. Add new ones in `backend/app.py`:

```python
"""Add custom endpoint to backend/app.py"""
@app.route('/api/batch', methods=['POST'])
def batch_generate():
    data = request.get_json()
    prompts = data.get('prompts', [])
    results = []
    
    for prompt in prompts:
        sequences = generator.generate_sequences(
            prompt=prompt,
            num_sequences=data.get('num_sequences', 3),
            max_length=data.get('max_length', 100)
        )
        for seq in sequences:
            results.append({
                'prompt': prompt,
                'sequence': seq,
                'fitness': generator.calculate_fitness_score(seq)
            })
    
    return jsonify({'sequences': results})
```

## Pattern 2: Add Custom Scoring Filters

```python
"""Add domain-specific filters to backend/generator.py or a new module."""
def calculate_hydrophobicity(sequence: str) -> float:
    hydrophobic = sum(1 for aa in sequence if aa in "GAVLIPFWM")
    return hydrophobic / len(sequence)

def filter_sequences(sequences: list[str], min_hydro: float = 0.3, max_hydro: float = 0.6) -> list[str]:
    return [
        seq for seq in sequences 
        if min_hydro <= calculate_hydrophobicity(seq) <= max_hydro
    ]
```

## Pattern 3: Batch Processing Mode

```python
"""Add batch processing for large-scale generation campaigns."""
import pandas as pd
from datetime import datetime

@app.route('/batch', methods=['POST'])
def batch_generate():
    prompts = request.json.get('prompts', [])
    results = []
    
    for prompt in prompts:
        sequences = generator.generate_sequences(prompt=prompt, num_sequences=10)
        for seq in sequences:
            results.append({
                'timestamp': datetime.now().isoformat(),
                'prompt': prompt,
                'sequence': seq,
                'length': len(seq),
                'fitness': generator.calculate_fitness_score(seq)
            })
    
    df = pd.DataFrame(results)
    df.to_csv('batch_results.csv', index=False)
    return jsonify({'status': 'complete', 'sequences_generated': len(results)})
```

## Pattern 4: Database Integration

```python
"""Store generated sequences in SQLite for tracking and analysis."""
import sqlite3

def init_db():
    conn = sqlite3.connect('sequences.db')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS sequences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prompt TEXT,
            sequence TEXT,
            fitness REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    return conn

@app.route('/generate', methods=['POST'])
def generate():
    sequences = generator.generate_sequences(...)
    
    conn = init_db()
    for seq in sequences:
        conn.execute(
            'INSERT INTO sequences (prompt, sequence, fitness) VALUES (?, ?, ?)',
            (prompt, seq, generator.calculate_fitness_score(seq))
        )
    conn.commit()
    
    return render_template('results.html', sequences=sequences)
```

## Pattern 5: Real-Time Validation Pipeline

```python
"""Integrate real-time validation checks before displaying results."""
from Bio.Seq import Seq

def validate_sequence(sequence):
    """Run biological validity checks."""
    checks = {
        'length_ok': 20 <= len(sequence) <= 500,
        'has_start_methionine': sequence.startswith('M'),
        'no_stop_codons': '*' not in sequence,
        'charge_balanced': -5 <= calculate_net_charge(sequence) <= 5,
    }
    return all(checks.values()), checks

@app.route('/generate', methods=['POST'])
def generate():
    sequences = generator.generate_sequences(...)
    
    validated = []
    for seq in sequences:
        is_valid, checks = validate_sequence(seq)
        validated.append({
            'sequence': seq,
            'valid': is_valid,
            'checks': checks
        })
    
    return render_template('results.html', results=validated)
```

## When to Build from Scratch

Consider building a custom application when:

- You need tight integration with existing enterprise systems
- The reference app's architecture doesn't fit your use case
- You need advanced features like streaming generation, multi-model comparison, or complex workflows
- You're building a production service with SLA requirements

For most rapid prototyping scenarios, **extending the reference app is faster and more maintainable** than building from scratch.
