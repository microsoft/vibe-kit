"""
Dayhoff Protein Sequence Generator

Generates synthetic protein sequences using Microsoft's Dayhoff models.
Supports loading multiple model variants on a single GPU.
"""

import re
import json
from datetime import datetime
from typing import Optional

import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

from constants import (
    GenerationMode,
    Direction,
    DEFAULT_MODEL_NAME,
    DEFAULT_PROMPT,
    DEFAULT_NUM_SEQUENCES,
    DEFAULT_MAX_LENGTH,
    DEFAULT_TEMPERATURE,
    MIN_LENGTH,
    MAX_LENGTH,
    NEUTRAL_SCORE,
    AVAILABLE_MODELS,
)


class DayhoffGenerator:
    """Protein sequence generator supporting multiple Dayhoff model variants."""

    def __init__(self, model_name: str = DEFAULT_MODEL_NAME, load_all: bool = False):
        """
        Initialize the Dayhoff sequence generator.

        Args:
            model_name: HuggingFace model identifier (used as default model)
            load_all: If True, load all models from AVAILABLE_MODELS at startup.
                      Requires ~20GB GPU memory (fits on A100 80GB).
        """
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.dtype = torch.bfloat16 if torch.cuda.is_available() else torch.float32
        self.models = {}
        self.tokenizers = {}
        self.default_model_key = None

        if load_all:
            self._load_all_models()
        else:
            self._load_single_model(model_name)

    def _load_single_model(self, model_name: str) -> None:
        """Load a single model (original behavior)."""
        print(f"Loading Dayhoff model: {model_name}")
        print("This may take a few minutes on first run...")

        try:
            tokenizer = AutoTokenizer.from_pretrained(
                model_name, trust_remote_code=True
            )
            model = AutoModelForCausalLM.from_pretrained(
                model_name,
                trust_remote_code=True,
                torch_dtype=self.dtype,
            )
            model = model.to(self.device)
            model.eval()

            if tokenizer.pad_token is None:
                tokenizer.pad_token = tokenizer.eos_token

            # Store under a key derived from the model name
            key = model_name.split("/")[-1] if "/" in model_name else model_name
            self.models[key] = model
            self.tokenizers[key] = tokenizer
            self.default_model_key = key
            self.model_name = model_name

            # Also expose as self.model / self.tokenizer for backward compatibility
            self.model = model
            self.tokenizer = tokenizer

            print(f"[OK] Model loaded: {key} on {self.device} ({self.dtype})")

        except Exception as e:
            print(f"[FAIL] Error loading model: {e}")
            raise

    def _load_all_models(self) -> None:
        """Load all models from AVAILABLE_MODELS onto a single GPU."""
        print(f"Loading {len(AVAILABLE_MODELS)} Dayhoff models onto {self.device}...")
        print(f"Using dtype: {self.dtype}")

        for key, config in AVAILABLE_MODELS.items():
            hf_id = config["hf_id"]
            print(f"  Loading {key} ({config['params']}) from {hf_id}...")

            try:
                tokenizer = AutoTokenizer.from_pretrained(
                    hf_id, trust_remote_code=True
                )
                model = AutoModelForCausalLM.from_pretrained(
                    hf_id,
                    trust_remote_code=True,
                    torch_dtype=self.dtype,
                )
                model = model.to(self.device)
                model.eval()

                if tokenizer.pad_token is None:
                    tokenizer.pad_token = tokenizer.eos_token

                self.models[key] = model
                self.tokenizers[key] = tokenizer
                print(f"  [OK] {key} loaded")

            except Exception as e:
                print(f"  [FAIL] {key} failed: {e}")
                # Continue loading other models — don't crash on one failure

        if not self.models:
            raise RuntimeError("No models loaded successfully")

        # Set default to first available
        self.default_model_key = next(iter(self.models))
        self.model = self.models[self.default_model_key]
        self.tokenizer = self.tokenizers[self.default_model_key]
        self.model_name = AVAILABLE_MODELS[self.default_model_key]["hf_id"]

        if torch.cuda.is_available():
            allocated = torch.cuda.memory_allocated() / 1e9
            print(f"\n[OK] All models loaded. GPU memory used: {allocated:.1f} GB")
        print(f"Available models: {list(self.models.keys())}")
        print(f"Default model: {self.default_model_key}")

    def _get_model_and_tokenizer(self, model_key: str | None = None):
        """Get the model and tokenizer for a given key."""
        if model_key is None:
            model_key = self.default_model_key

        if model_key not in self.models:
            available = list(self.models.keys())
            raise ValueError(
                f"Model '{model_key}' not loaded. Available: {available}"
            )

        return self.models[model_key], self.tokenizers[model_key]

    def get_available_models(self) -> list[dict]:
        """Return info about loaded models."""
        result = []
        for key in self.models:
            config = AVAILABLE_MODELS.get(key, {})
            result.append({
                "key": key,
                "params": config.get("params", "unknown"),
                "description": config.get("description", ""),
                "supports_homologs": config.get("supports_homologs", False),
                "loaded": True,
            })
        return result

    def generate_sequences(
        self,
        prompt: str = DEFAULT_PROMPT,
        num_sequences: int = DEFAULT_NUM_SEQUENCES,
        max_length: int = DEFAULT_MAX_LENGTH,
        temperature: float = DEFAULT_TEMPERATURE,
        generation_mode: str = GenerationMode.UNCONDITIONAL,
        direction: str = Direction.N_TO_C,
        model_key: str | None = None,
    ) -> list[str]:
        """
        Generate protein sequences using a Dayhoff model variant.

        Args:
            prompt: Starting amino acid sequence (e.g., "M", "MK", "GAVL")
            num_sequences: Number of sequences to generate
            max_length: Maximum length of generated sequences
            temperature: Sampling temperature (0.1-2.0, higher = more diverse)
            generation_mode: Generation mode from GenerationMode constants
            direction: Generation direction from Direction constants
            model_key: Which model variant to use (e.g., "3b-GR-HM-c").
                       None = use default model.

        Returns:
            List of generated protein sequences
        """
        model, tokenizer = self._get_model_and_tokenizer(model_key)
        active_key = model_key or self.default_model_key

        print(
            f"Generating {num_sequences} sequences with model '{active_key}', "
            f"mode '{generation_mode}', direction '{direction}'"
        )
        print(
            f"Starting prompt: '{prompt}', Max length: {max_length}, "
            f"Temperature: {temperature}"
        )

        # Handle empty prompt (random generation)
        if not prompt or prompt.strip() == "":
            prompt = ""

        # Get generation parameters based on mode
        gen_params = self._get_generation_params(generation_mode, temperature)

        # Handle bidirectional generation
        if direction == Direction.C_TO_N and prompt:
            prompt = prompt[::-1]  # Reverse prompt for C-to-N generation

        # Tokenize input
        inputs = tokenizer(
            prompt, return_tensors="pt", padding=True, truncation=True
        )
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        # Generate sequences
        with torch.no_grad():
            outputs = model.generate(
                inputs["input_ids"],
                attention_mask=inputs["attention_mask"],
                max_length=max_length,
                temperature=max(gen_params["temperature"], 0.5),
                do_sample=True,
                num_return_sequences=num_sequences,
                pad_token_id=tokenizer.pad_token_id,
                eos_token_id=tokenizer.eos_token_id,
                top_k=gen_params["top_k"],
                top_p=gen_params["top_p"],
                repetition_penalty=gen_params["repetition_penalty"],
                no_repeat_ngram_size=2,
            )

        # Decode sequences
        sequences = []
        for i, output in enumerate(outputs):
            sequence = tokenizer.decode(output, skip_special_tokens=True)

            # Handle C-to-N direction by reversing the output
            if direction == Direction.C_TO_N:
                sequence = sequence[::-1]

            sequences.append(sequence)
            print(f"Sequence {i + 1} ({generation_mode}, {direction}): {sequence}")

        return sequences

    def _get_generation_params(self, generation_mode: str, temperature: float) -> dict:
        """Get generation parameters based on mode."""
        if generation_mode == GenerationMode.FAMILY_GUIDED:
            return {
                "temperature": min(temperature, 1.2),
                "top_k": 25,
                "top_p": 0.8,
                "repetition_penalty": 1.15,
            }
        elif generation_mode == GenerationMode.MOTIF_SCAFFOLDING:
            return {
                "temperature": max(temperature, 0.6),
                "top_k": 35,
                "top_p": 0.82,
                "repetition_penalty": 1.1,
            }
        else:  # UNCONDITIONAL
            return {
                "temperature": temperature,
                "top_k": 40,
                "top_p": 0.85,
                "repetition_penalty": 1.2,
            }

    def calculate_fitness_score(self, sequence: str, model_key: str | None = None) -> float:
        """
        Calculate zero-shot fitness prediction using Dayhoff model likelihood.

        Based on research paper methodology for mutation effect prediction.

        Args:
            sequence: Protein sequence to evaluate
            model_key: Which model variant to use. None = default.

        Returns:
            Fitness score (0-100, higher = more likely to be functional)
        """
        model, tokenizer = self._get_model_and_tokenizer(model_key)

        try:
            inputs = tokenizer(
                sequence, return_tensors="pt", padding=True, truncation=True
            )
            inputs = {k: v.to(self.device) for k, v in inputs.items()}

            with torch.no_grad():
                outputs = model(
                    inputs["input_ids"], attention_mask=inputs["attention_mask"]
                )
                logits = outputs.logits

                # Calculate per-token probabilities
                shift_logits = logits[..., :-1, :].contiguous()
                shift_labels = inputs["input_ids"][..., 1:].contiguous()

                # Calculate log probabilities
                log_probs = torch.nn.functional.log_softmax(shift_logits, dim=-1)

                # Get probabilities for actual tokens
                token_log_probs = log_probs.gather(
                    2, shift_labels.unsqueeze(-1)
                ).squeeze(-1)

                # Mask out padding tokens
                if inputs["attention_mask"] is not None:
                    mask = inputs["attention_mask"][..., 1:].bool()
                    token_log_probs = token_log_probs.masked_fill(~mask, 0)
                    sequence_length = mask.sum().item()
                else:
                    sequence_length = token_log_probs.size(-1)

                # Calculate average log probability
                avg_log_prob = token_log_probs.sum().item() / max(sequence_length, 1)

                # Convert to fitness score (0-100 scale)
                normalized_score = torch.sigmoid(torch.tensor(avg_log_prob + 5)).item()
                fitness_score = normalized_score * 100

                return min(max(fitness_score, 0), 100)

        except Exception as e:
            print(f"Warning: Could not calculate fitness score: {e}")
            return NEUTRAL_SCORE

    def validate_sequences(self, sequences: list[str]) -> dict:
        """
        Validate generated sequences for standard amino acid composition.

        Args:
            sequences: List of amino acid sequences

        Returns:
            Validation results with valid sequences and statistics
        """
        valid_sequences = []
        invalid_sequences = []

        # Standard 20 amino acid validation
        valid_pattern = re.compile(r"^[ACDEFGHIKLMNPQRSTVWY]+$")

        for seq in sequences:
            if valid_pattern.match(seq.upper()):
                if MIN_LENGTH <= len(seq) <= MAX_LENGTH:
                    valid_sequences.append(seq.upper())
                else:
                    invalid_sequences.append(
                        (
                            seq,
                            f"Length {len(seq)} outside range {MIN_LENGTH}-{MAX_LENGTH}",
                        )
                    )
            else:
                invalid_sequences.append((seq, "Contains invalid amino acids"))

        total = len(sequences) if sequences else 1
        return {
            "valid_sequences": valid_sequences,
            "invalid_sequences": invalid_sequences,
            "valid_count": len(valid_sequences),
            "invalid_count": len(invalid_sequences),
            "success_rate": len(valid_sequences) / total * 100,
        }

    def save_sequences(
        self, sequences: list[str], filename: Optional[str] = None
    ) -> str:
        """
        Save generated sequences to JSON file.

        Args:
            sequences: List of sequences to save
            filename: Output filename (auto-generated if None)

        Returns:
            Path to saved file
        """
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"dayhoff_sequences_{timestamp}.json"

        data = {
            "model": self.model_name,
            "timestamp": datetime.now().isoformat(),
            "sequences": sequences,
            "count": len(sequences),
        }

        with open(filename, "w") as f:
            json.dump(data, f, indent=2)

        print(f"Sequences saved to {filename}")
        return filename
