"""
Dayhoff Protein Sequence Generator — Scoring Container

Generates synthetic protein sequences using Microsoft's Dayhoff models.
Supports loading multiple model variants on a single GPU.

Patched for container deployment: use_mamba_kernels=False to avoid
mamba-ssm/flash-attn build dependencies.
"""

import re
import json
from datetime import datetime
from typing import Optional

import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, SuppressTokensLogitsProcessor

from constants import (
    GenerationMode,
    Direction,
    DEFAULT_MODEL_NAME,
    DEFAULT_PROMPT,
    DEFAULT_NUM_SEQUENCES,
    DEFAULT_MAX_LENGTH,
    DEFAULT_TEMPERATURE,
    DEFAULT_MIN_P,
    MIN_LENGTH,
    MAX_LENGTH,
    NEUTRAL_SCORE,
    AVAILABLE_MODELS,
)

# Special tokens from the Dayhoff alphabet (see dayhoff/tokenizers.py upstream).
# Kept in sync with microsoft/dayhoff @ main.
START = "@"
STOP = "*"
SEP = "/"
START_UL = "{"
CAN_AAS = "ACDEFGHIKLMNPQRSTVWY"  # 20 standard amino acids


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
                use_mamba_kernels=False,
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
                    use_mamba_kernels=False,
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

    def _build_logits_processor(self, tokenizer, eos_id: int):
        """Restrict generation to the 20 canonical amino acids + the chosen EOS.

        Mirrors the SuppressTokensLogitsProcessor pattern used by every official
        Dayhoff inference script (examples/generate.py, src/generate.py,
        analysis/generate*.py). Without this, the model can emit special tokens
        (gap '-', rare AAs B/Z/X/J/O/U, structural markers) that contaminate
        outputs and contribute to degenerate sampling.
        """
        alphabet = tokenizer.alphabet
        all_tokens = list(range(len(alphabet)))
        allowed = {alphabet.index(aa) for aa in CAN_AAS}
        allowed.add(eos_id)
        suppress = [t for t in all_tokens if t not in allowed]
        return SuppressTokensLogitsProcessor(suppress, device=self.device)

    def generate_sequences(
        self,
        prompt: str = DEFAULT_PROMPT,
        num_sequences: int = DEFAULT_NUM_SEQUENCES,
        max_length: int = DEFAULT_MAX_LENGTH,
        temperature: float = DEFAULT_TEMPERATURE,
        generation_mode: str = GenerationMode.UNCONDITIONAL,
        direction: str = Direction.N_TO_C,
        model_key: str | None = None,
        homologs: list[str] | None = None,
        min_p: float = DEFAULT_MIN_P,
    ) -> list[str]:
        """
        Generate protein sequences using a Dayhoff model variant.

        Args:
            prompt: Starting amino acid sequence (e.g., "M", "MK", "GAVL"). If
                empty, the model generates unconditionally from the START token.
            num_sequences: Number of sequences to generate
            max_length: Maximum length of generated sequences
            temperature: Sampling temperature (0.1-2.0, higher = more diverse)
            generation_mode: Generation mode from GenerationMode constants
            direction: Generation direction from Direction constants
            model_key: Which model variant to use (e.g., "3b-GR-HM-c").
                       None = use default model.
            homologs: Optional list of homolog sequences for HM/HM-c models.
                When provided, the prompt becomes
                ``START_UL + SEP.join(homologs) + SEP + seed`` and EOS is SEP
                (matches src/generate_from_homologs.py upstream).
            min_p: Minimum-probability sampling cutoff (0.0-1.0). Upstream
                default is 0.0 in the simplest scripts but 0.05 is the value
                used in production-quality runs (cas9, homolog-conditioned).

        Returns:
            List of generated protein sequences (special tokens stripped)
        """
        model, tokenizer = self._get_model_and_tokenizer(model_key)
        active_key = model_key or self.default_model_key

        # Decide BOS prefix and EOS token, matching the official scripts.
        # - With homologs: prompt = START_UL + SEP.join(seqs) + SEP + seed,
        #   EOS = SEP (model emits one '/' to terminate the new sequence).
        # - Without homologs: prompt = START + seed, EOS = STOP ('*').
        alphabet = tokenizer.alphabet
        if homologs:
            eos_id = alphabet.index(SEP)
            # Reverse seed for C-to-N if requested (homolog text stays N→C).
            seed = (prompt or "")[::-1] if direction == Direction.C_TO_N else (prompt or "")
            tokenize_me = START_UL + SEP.join(homologs) + SEP + seed
        else:
            eos_id = alphabet.index(STOP)
            seed = (prompt or "")[::-1] if direction == Direction.C_TO_N else (prompt or "")
            tokenize_me = START + seed

        # Set EOS so the model can stop naturally instead of running to
        # max_new_tokens (the latter is what triggers seed-tiling loops).
        model.generation_config.eos_token_id = eos_id
        model.generation_config.pad_token_id = tokenizer.pad_token_id

        logits_processor = self._build_logits_processor(tokenizer, eos_id)

        print(
            f"Generating {num_sequences} seqs with '{active_key}' "
            f"mode={generation_mode} dir={direction} "
            f"temp={temperature} min_p={min_p} "
            f"homologs={len(homologs) if homologs else 0} "
            f"eos_id={eos_id} prompt_len={len(tokenize_me)}"
        )

        inputs = tokenizer(
            tokenize_me, return_tensors="pt", return_token_type_ids=False
        )
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        # Generate. Parameters mirror examples/generate.py upstream:
        # do_sample + temperature + min_p, with logits_processor suppressing
        # non-canonical tokens. No top_k / top_p / repetition_penalty.
        with torch.no_grad():
            outputs = model.generate(
                inputs["input_ids"],
                max_new_tokens=max_length,
                do_sample=True,
                num_return_sequences=num_sequences,
                temperature=temperature,
                min_p=min_p,
                num_beams=1,
                use_cache=True,
                logits_processor=[logits_processor],
            )

        # Decode without auto-stripping so we can split out the homolog
        # context block, then strip the structural markers ourselves.
        sequences = []
        for i, output in enumerate(outputs):
            decoded = tokenizer.decode(output, skip_special_tokens=False)

            if homologs:
                # Output looks like: START_UL h1 SEP h2 SEP … SEP seed+gen SEP?
                # The new sequence is the segment after the last SEP that
                # belongs to the prompt; mirror examples/generate.py logic.
                if decoded.endswith(SEP):
                    new_seq = decoded.split(SEP)[-2]
                else:
                    new_seq = decoded.split(SEP)[-1]
            else:
                # Strip BOS / EOS markers; anything else non-canonical is
                # already suppressed by the logits processor.
                new_seq = decoded.replace(START, "").replace(STOP, "")

            # Defensive: drop any remaining structural markers if the model
            # somehow emitted one before suppression took effect.
            for marker in (START_UL, "}", "[", "]", SEP):
                new_seq = new_seq.replace(marker, "")

            if direction == Direction.C_TO_N:
                new_seq = new_seq[::-1]

            sequences.append(new_seq)
            preview = new_seq[:80] + ("…" if len(new_seq) > 80 else "")
            print(f"Sequence {i + 1} (len={len(new_seq)}): {preview}")

        return sequences

    # NOTE: _get_generation_params was removed.
    # The official Dayhoff repo uses only temperature and min_p for all modes.
    # No top_k, top_p, repetition_penalty, or no_repeat_ngram_size.
    # See: github.com/microsoft/dayhoff  src/generate.py

    def calculate_fitness_score(self, sequence: str, model_key: str | None = None) -> float:
        """
        Calculate zero-shot fitness using Dayhoff's official scoring method.

        Matches examples/score.py from github.com/microsoft/dayhoff:
        - Wraps sequence with BOS (@) and EOS (*) tokens
        - Computes forward (N→C) average log-likelihood via model loss
        - Computes backward (C→N) average log-likelihood via model loss
        - Returns average of both, normalized to 0-100 for display

        The raw log-likelihood is the metric used for ProteinGym zero-shot
        benchmarks. Higher = model considers this sequence more plausible.

        Args:
            sequence: Protein sequence to evaluate
            model_key: Which model variant to use. None = default.

        Returns:
            Fitness score (0-100 scale, higher = more plausible)
        """
        model, tokenizer = self._get_model_and_tokenizer(model_key)

        try:
            bos = tokenizer.bos_token or "@"
            eos = tokenizer.eos_token or "*"

            # Forward: BOS + sequence + EOS (standard N→C)
            fwd_seq = bos + sequence + eos
            # Backward: EOS + reversed_sequence + BOS (C→N)
            bwd_seq = eos + sequence[::-1] + bos

            fwd_tokens = tokenizer(
                fwd_seq, return_tensors="pt", return_token_type_ids=False
            )
            bwd_tokens = tokenizer(
                bwd_seq, return_tensors="pt", return_token_type_ids=False
            )

            fwd_tokens = {k: v.to(self.device) for k, v in fwd_tokens.items()}
            bwd_tokens = {k: v.to(self.device) for k, v in bwd_tokens.items()}

            with torch.no_grad():
                # Forward log-likelihood (negative cross-entropy loss)
                fwd_out = model(
                    input_ids=fwd_tokens["input_ids"],
                    labels=fwd_tokens["input_ids"],
                )
                fwd_ll = -fwd_out.loss.item()

                # Backward log-likelihood
                bwd_out = model(
                    input_ids=bwd_tokens["input_ids"],
                    labels=bwd_tokens["input_ids"],
                )
                bwd_ll = -bwd_out.loss.item()

            # Average of forward and backward log-likelihoods
            avg_ll = (fwd_ll + bwd_ll) / 2.0

            # Normalize to 0-100 for display
            # Typical avg_ll range for real proteins: -1.5 (high quality) to -5.0 (poor)
            # sigmoid maps this to a usable visual range
            normalized = torch.sigmoid(torch.tensor(avg_ll + 3.0)).item()
            return min(max(normalized * 100, 0), 100)

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
