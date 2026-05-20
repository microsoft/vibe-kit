"""Model evaluation utilities for Aurora fine-tuning."""

from datetime import timedelta
from aurora import Batch, Metadata
import json
from pathlib import Path

from aurora import Aurora
import numpy as np
import torch
from pydantic import BaseModel, Field

from vibe_tune_aurora.aurora_module import LitAurora
from vibe_tune_aurora.data_processing.data_utils import ERA5Dataset, load_normalization_stats
from vibe_tune_aurora.losses import compute_mae_loss
from vibe_tune_aurora.custom_types import SupervisedTrainingDataPair


class EvaluationResult(BaseModel):
    """Results from model evaluation containing MAE loss statistics."""

    mean_mae: float = Field(
        description="Mean of the Mean Absolute Error loss across all evaluated samples"
    )
    std_mae: float = Field(
        description="Standard deviation of the Mean Absolute Error loss across all evaluated "
        "samples"
    )
    min_mae: float = Field(
        description="Minimum Mean Absolute Error loss observed across all evaluated samples"
    )
    max_mae: float = Field(
        description="Maximum Mean Absolute Error loss observed across all evaluated samples"
    )
    num_samples: int = Field(description="Total number of samples used in the evaluation")
    target_vars: list[str] = Field(description="List of target variable names that were evaluated")


class PersistenceModel:
    """
    A bare bones class that has a `forward` method  that persists the values at current timestep
    as the predicted values for next timestep (i.e. persistence model).
    This is a commonly used simple baseline for time series prediction.
    """

    def __init__(self):
        pass

    def forward(self, input_batch: Batch) -> Batch:
        """
        Outputs the persistence model prediction, i.e.  persists the current timestep as the
        future timestep prediction.
        Assumes 6 hour timestep
        """
        time_delta = timedelta(hours=6)

        # Grab latest timestep's data from surface_vars and atmospheric_vars
        new_surf_vars = _copy_latest_timestep_of_values_dict(input_batch.surf_vars)
        new_atmos_vars = _copy_latest_timestep_of_values_dict(input_batch.atmos_vars)

        # copy static vars
        static_vars_copy = {
            var_name: var_tensor.detach().clone()
            for var_name, var_tensor in input_batch.static_vars.items()
        }

        # update timestamp in metadata
        old_metadata = input_batch.metadata
        assert len(old_metadata.time) == 1
        new_meta_data = Metadata(
            lat=old_metadata.lat,
            lon=old_metadata.lon,
            time=(old_metadata.time[0] + time_delta,),
            atmos_levels=old_metadata.atmos_levels,
        )

        return Batch(
            surf_vars=new_surf_vars,
            static_vars=static_vars_copy,
            atmos_vars=new_atmos_vars,
            metadata=new_meta_data,
        )


def load_aurora_lightning_module(checkpoint_path: Path) -> LitAurora:
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
    aurora_model: Aurora | PersistenceModel,
    evaluation_data_pairs: list[SupervisedTrainingDataPair],
    target_vars: tuple[str, ...],
    output_json: Path | None = None,
) -> EvaluationResult:
    """
    Evaluate finetuned model on entire dataset using single-step inference.

    Args:
        checkpoint_path: Path to model checkpoint file
        evaluation_data_pairs: List of SupervisedTrainingDataPair objects for evaluation
        target_vars: Tuple of target variable names for evaluation
        output_json: Optional path to save results as JSON

    Returns:
        EvaluationResult containing evaluation metrics

    Raises:
        FileNotFoundError: If checkpoint doesn't exist
    """
    if not (isinstance(aurora_model, Aurora) | isinstance(aurora_model, PersistenceModel)):
        raise ValueError(
            f"The `aurora_model` argument must be of type `Aurora` or `PersistenceModel`. "
            f"Instead, we got: {type(aurora_model)}"
        )

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
            prediction_batch = aurora_model.forward(input_batch)

        # Compute loss using unified loss function
        loss_tensor, n_vars = compute_mae_loss(
            prediction_batch,
            target_batch,
            target_vars,
            norm_stats,
        )
        loss = loss_tensor.item()  # Convert tensor to float for statistics
        losses.append(loss)

        if (i + 1) % 10 == 0:
            print(f"  Processed {i + 1}/{len(dataset)} samples")

    # Compute statistics
    losses_array = np.array(losses)
    results = EvaluationResult(
        mean_mae=float(np.mean(losses_array)),
        std_mae=float(np.std(losses_array)),
        min_mae=float(np.min(losses_array)),
        max_mae=float(np.max(losses_array)),
        num_samples=len(losses),
        target_vars=list(target_vars),
    )

    print("\n=== Model Evaluation Results ===")
    print(f"Target variables: {target_vars}")
    print(f"Number of samples: {results.num_samples}")
    print(f"Mean MAE loss: {results.mean_mae:.6f}")
    print(f"Std MAE loss: {results.std_mae:.6f}")
    print(f"Min MAE loss: {results.min_mae:.6f}")
    print(f"Max MAE loss: {results.max_mae:.6f}")
    print("\nEvaluation method: Single-step inference")

    # Save to JSON if specified
    if output_json is not None:
        output_json.parent.mkdir(parents=True, exist_ok=True)
        with open(output_json, "w") as f:
            json.dump(results.model_dump(), f, indent=2)
        print(f"\nResults saved to: {output_json}")

    return results


def _copy_latest_timestep_of_values_dict(
    values_dict: dict[str, torch.Tensor],
) -> dict[str, torch.Tensor]:
    """
    Helper function to get latest timestep.
    Values dict refers to either a surf_vars or atmos_vars.
    """
    new_values_dict = {}
    var_names = values_dict.keys()
    for var_name in var_names:
        old_values_copy = values_dict[var_name].detach().clone()

        # Confirm 2 timesteps. Values dict's tensor shape should be
        # (batch_size, num_timesteps, ...)
        assert old_values_copy.shape[1] == 2

        # Grab latest timestep, then unsqueeze to preserve timesteps dimension
        new_values = old_values_copy[:, -1, ...].unsqueeze(1)
        new_values_dict[var_name] = new_values

    return new_values_dict
