"""Generate quick-look visualizations from finetuned Aurora checkpoints."""

from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib.pyplot as plt  # type: ignore[import]
import numpy as np  # type: ignore[import]
import torch  # type: ignore[import]

from vibe_tune_aurora.data_processing.data_utils import ERA5Dataset
from vibe_tune_aurora.data_processing.extract_data_from_grib import (
    extract_training_data_from_grib,
)
from vibe_tune_aurora.evaluation import load_model
from vibe_tune_aurora.types import SupervisedTrainingDataPair


def _extract_surface_field(batch, var_name: str) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Return (data, lat, lon) arrays for a surface variable from an Aurora Batch."""
    if var_name not in batch.surf_vars:
        available = ", ".join(sorted(batch.surf_vars.keys()))
        raise KeyError(f"Variable '{var_name}' not found in batch. Available: {available}")

    tensor = batch.surf_vars[var_name]
    # Expect shape (batch, time, lat, lon); take first batch + latest time slice
    data = tensor.detach().cpu().numpy()[0, -1]

    lat = np.asarray(batch.metadata.lat)
    lon = np.asarray(batch.metadata.lon)

    # Ensure 1D arrays for meshgrid
    if lat.ndim > 1:
        lat = lat[:, 0]
    if lon.ndim > 1:
        lon = lon[0, :]

    return data, lat, lon


def visualize_prediction(
    checkpoint_path: Path,
    training_data_pairs: list[SupervisedTrainingDataPair],
    var_name: str,
    sample_index: int,
    output_path: Path,
    difference: bool,
    cmap: str,
    dark_mode: bool = False,
) -> Path:
    """Render prediction vs. target heatmaps for a single sample."""
    dataset = ERA5Dataset(training_data_pairs)

    if sample_index < 0 or sample_index >= len(dataset):
        raise IndexError(
            f"Sample index {sample_index} out of range for dataset of size {len(dataset)}"
        )

    input_batch, target_batch = dataset[sample_index]

    model = load_model(checkpoint_path)
    model.eval()

    with torch.inference_mode():
        prediction_batch = model.model.forward(input_batch)

    # Extract arrays
    pred_data, lat, lon = _extract_surface_field(prediction_batch, var_name)
    target_data, *_ = _extract_surface_field(target_batch, var_name)

    error_data = np.abs(pred_data - target_data)

    lon_grid, lat_grid = np.meshgrid(lon, lat)

    timestamp = target_batch.metadata.time[0]

    # Apply dark mode styling
    if dark_mode:
        plt.style.use('dark_background')

    # Plot prediction, target, and absolute error
    fig, axes = plt.subplots(1, 3 if difference else 2, figsize=(16, 5), constrained_layout=True)
    if not isinstance(axes, np.ndarray):
        axes = np.array([axes])

    # Compute shared min/max for prediction and target to ensure same colorbar scale
    shared_vmin = min(pred_data.min(), target_data.min())
    shared_vmax = max(pred_data.max(), target_data.max())

    titles = [
        f"Prediction ({var_name})",
        f"Target ({var_name})",
        "|Prediction − Target|" if difference else None,
    ]
    datasets = [pred_data, target_data, error_data if difference else None]

    for i, (ax, title, data) in enumerate(zip(axes, titles, datasets)):
        if data is None:
            ax.axis("off")
            continue

        # Use shared scale for prediction and target, error has its own scale
        if i < 2:  # Prediction and target panels
            pcm = ax.pcolormesh(lon_grid, lat_grid, data, shading="auto", cmap=cmap,
                               vmin=shared_vmin, vmax=shared_vmax)
        else:  # Error panel
            pcm = ax.pcolormesh(lon_grid, lat_grid, data, shading="auto", cmap=cmap)

        ax.set_title(title)
        ax.set_xlabel("Longitude")
        ax.set_ylabel("Latitude")
        ax.set_ylim(lat.min(), lat.max())
        plt.colorbar(pcm, ax=ax, orientation="vertical", label=var_name)

    fig.suptitle(
        f"Aurora finetune quick-look | Sample {sample_index} | {timestamp.isoformat()} | {var_name}",
        fontsize=14,
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(str(output_path), dpi=200)
    plt.close(fig)

    # Reset style to default
    if dark_mode:
        plt.style.use('default')

    print(f"Saved visualization to {output_path}")
    return output_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render prediction vs. target heatmaps for a finetuned Aurora checkpoint",
    )
    parser.add_argument("--checkpoint", type=Path, required=True, help="Path to .ckpt file")
    parser.add_argument(
        "--single_level_file",
        type=Path,
        required=True,
        help="Path to ERA5 single-level GRIB file",
    )
    parser.add_argument(
        "--pressure_level_file",
        type=Path,
        required=True,
        help="Path to ERA5 pressure-level GRIB file",
    )
    parser.add_argument(
        "--var",
        type=str,
        default="2t",
        help="Surface variable name to visualize (default: 2t)",
    )
    parser.add_argument(
        "--sample_index",
        type=int,
        default=0,
        help="Index of sample within dataset to visualize (default: 0)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("runs/visuals/sample.png"),
        help="Path to save the generated PNG",
    )
    parser.add_argument(
        "--difference",
        action="store_true",
        help="Include absolute difference panel between prediction and target",
    )
    parser.add_argument(
        "--cmap",
        type=str,
        default="coolwarm",
        help="Matplotlib colormap for the heatmaps (default: coolwarm)",
    )
    parser.add_argument(
        "--patch_size",
        type=int,
        default=4,
        help="Patch size for Aurora model - spatial dimensions will be cropped to multiples (default: 4)",
    )
    parser.add_argument(
        "--skip_first_n_timesteps",
        type=int,
        default=0,
        help="Number of initial timesteps to skip before creating training pairs (default: 0)",
    )
    parser.add_argument(
        "--dark_mode",
        action="store_true",
        help="Enable dark mode styling for the visualization",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    # Extract training data from GRIB files
    print(f"Extracting training data from GRIB files...")
    training_data_pairs = extract_training_data_from_grib(
        single_level_file=args.single_level_file,
        pressure_level_file=args.pressure_level_file,
        patch_size=args.patch_size,
        skip_first_n_timesteps=args.skip_first_n_timesteps,
    )

    visualize_prediction(
        checkpoint_path=args.checkpoint,
        training_data_pairs=training_data_pairs,
        var_name=args.var,
        sample_index=args.sample_index,
        output_path=args.output,
        difference=args.difference,
        cmap=args.cmap,
        dark_mode=args.dark_mode,
    )


if __name__ == "__main__":
    main()
