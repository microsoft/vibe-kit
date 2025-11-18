"""Model evaluation utilities for Aurora fine-tuning."""

import json
from pathlib import Path

import numpy as np
import torch

from vibe_tune_aurora.aurora_module import LitAurora
from vibe_tune_aurora.data_processing.data_utils import ERA5Dataset, load_normalization_stats
from vibe_tune_aurora.losses import compute_mae_loss
from vibe_tune_aurora.types import SupervisedTrainingDataPair


def load_model(checkpoint_path: Path) -> LitAurora:
    """
    Load finetuned Aurora model from checkpoint.

    Args:
        checkpoint_path: Path to PyTorch Lightning checkpoint file (LitAuroraUV format)

    Returns:
        Loaded LitAuroraUV model ready for inference

    Raises:
        FileNotFoundError: If checkpoint doesn't exist
    """
    if not checkpoint_path.exists():
        raise FileNotFoundError(f"Checkpoint not found: {checkpoint_path}")

    model = LitAurora.load_from_checkpoint(checkpoint_path)
    model.eval()
    return model


def evaluate_model(
    aurora_lightning_module: LitAurora,
    evaluation_data_pairs: list[SupervisedTrainingDataPair],
    target_vars: tuple[str, ...],
    output_json: Path | None = None,
) -> dict:
    """
    Evaluate finetuned model on entire dataset using single-step inference.

    Args:
        checkpoint_path: Path to model checkpoint file
        evaluation_data_pairs: List of SupervisedTrainingDataPair objects for evaluation
        target_vars: Tuple of target variable names for evaluation
        output_json: Optional path to save results as JSON

    Returns:
        Dictionary containing evaluation metrics:
        - mean_mae: Mean MAE loss across all samples
        - std_mae: Standard deviation of MAE loss
        - min_mae: Minimum MAE loss
        - max_mae: Maximum MAE loss
        - num_samples: Number of samples evaluated
        - target_vars: Target variables used
        - checkpoint_path: Path to checkpoint used

    Raises:
        FileNotFoundError: If checkpoint doesn't exist
    """
    dataset = ERA5Dataset(evaluation_data_pairs)

    # Load normalization statistics
    norm_stats = load_normalization_stats(target_vars)

    # Evaluate model on all samples
    losses = []

    print("Computing model losses...")
    for i in range(len(dataset)):
        input_batch, target_batch = dataset[i]

        # Run single-step inference
        with torch.inference_mode():
            prediction_batch = aurora_lightning_module.model.forward(input_batch)

        # Compute loss using unified loss function
        loss_tensor, n_vars = compute_mae_loss(
            prediction_batch,
            target_batch,
            target_vars,
            norm_stats,
            aurora_lightning_module.device,
        )
        loss = loss_tensor.item()  # Convert tensor to float for statistics
        losses.append(loss)

        if (i + 1) % 10 == 0:
            print(f"  Processed {i + 1}/{len(dataset)} samples")

    # Compute statistics
    losses_array = np.array(losses)
    results = {
        "mean_mae": float(np.mean(losses_array)),
        "std_mae": float(np.std(losses_array)),
        "min_mae": float(np.min(losses_array)),
        "max_mae": float(np.max(losses_array)),
        "num_samples": len(losses),
        "target_vars": list(target_vars),
    }

    print(f"\n=== Model Evaluation Results ===")
    print(f"Target variables: {target_vars}")
    print(f"Number of samples: {results['num_samples']}")
    print(f"Mean MAE loss: {results['mean_mae']:.6f}")
    print(f"Std MAE loss: {results['std_mae']:.6f}")
    print(f"Min MAE loss: {results['min_mae']:.6f}")
    print(f"Max MAE loss: {results['max_mae']:.6f}")
    print(f"\nEvaluation method: Single-step inference")

    # Save to JSON if specified
    if output_json is not None:
        output_json.parent.mkdir(parents=True, exist_ok=True)
        with open(output_json, "w") as f:
            json.dump(results, f, indent=2)
        print(f"\nResults saved to: {output_json}")

    return results
