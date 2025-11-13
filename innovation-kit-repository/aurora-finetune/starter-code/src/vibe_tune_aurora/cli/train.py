"""Command-line interface for Aurora fine-tuning."""

import argparse
from pathlib import Path

from vibe_tune_aurora.config import TARGET_VAR_PRESETS, TrainingConfig
from vibe_tune_aurora.data_processing.extract_data_from_grib import (
    extract_training_data_from_grib,
)
from vibe_tune_aurora.training import train_era5_model


def main():
    """Command-line interface for Aurora fine-tuning."""
    parser = argparse.ArgumentParser(
        description="Train Aurora model on ERA5 UV/cloud data"
    )

    # Required arguments
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
        "--loss_type",
        type=str,
        required=True,
        choices=list(TARGET_VAR_PRESETS.keys()),
        help="Loss function type: '4_vars' for all 4 variables (tcc,tclw,uvb,ssrdc), "
        "'2_cloud_vars' for cloud variables only (tcc,tclw), "
        "'2t_var' for 2-meter temperature only (2t), "
        "'uvb_var' for UV radiation only (uvb)",
    )

    # Optional arguments with defaults from TrainingConfig
    parser.add_argument(
        "--max_epochs",
        type=int,
        default=3,
        help="Maximum number of training epochs (default: 3)",
    )
    parser.add_argument(
        "--learning_rate",
        type=float,
        default=2e-4,
        help="Learning rate for optimizer (default: 2e-4)",
    )
    parser.add_argument(
        "--train_ratio",
        type=float,
        default=0.8,
        help="Ratio of data to use for training vs validation (default: 0.8)",
    )
    parser.add_argument(
        "--init-mode",
        type=str,
        default="pretrained_and_custom",
        choices=[
            "pretrained_and_custom",
            "pretrained",
            "initialized_and_custom",
            "initializer_checkpoint",
        ],
        help="Model initialization mode: 'pretrained_and_custom' for pretrained weights + custom vars, "
        "'pretrained' for pretrained weights only, "
        "'initialized_and_custom' for random initialization + custom vars, "
        "'initializer_checkpoint' for loading from custom initializer checkpoint",
    )
    parser.add_argument(
        "--initializer-checkpoint-path",
        type=str,
        default=None,
        help="Path to initializer checkpoint file (required when --init-mode is 'initializer_checkpoint')",
    )
    parser.add_argument(
        "--lr_scheduler",
        type=str,
        default=None,
        choices=[None, "cosine_annealing"],
        help="Learning rate scheduler: None for no scheduler, 'cosine_annealing' for cosine annealing (default: None)",
    )
    parser.add_argument(
        "--log_dir",
        type=Path,
        default="tb_logs",
        help="Directory for TensorBoard logs (default: tb_logs)",
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

    args = parser.parse_args()

    # Validate initializer_checkpoint_path requirement
    if (
        args.init_mode == "initializer_checkpoint"
        and args.initializer_checkpoint_path is None
    ):
        parser.error(
            "--initializer-checkpoint-path is required when --init-mode is 'initializer_checkpoint'"
        )

    # Get target variables from preset
    target_vars = TARGET_VAR_PRESETS[args.loss_type]

    # Create config from args
    config = TrainingConfig(
        max_epochs=args.max_epochs,
        learning_rate=args.learning_rate,
        train_ratio=args.train_ratio,
        init_mode=args.init_mode,
        lr_scheduler=args.lr_scheduler,
        initializer_checkpoint_path=args.initializer_checkpoint_path,
        log_dir=args.log_dir,
    )

    # Extract training data from GRIB files
    print(f"Extracting training data from GRIB files...")
    training_data_pairs = extract_training_data_from_grib(
        single_level_file=args.single_level_file,
        pressure_level_file=args.pressure_level_file,
        patch_size=args.patch_size,
        skip_first_n_timesteps=args.skip_first_n_timesteps,
    )

    # Train
    print(f"Training with loss type: {args.loss_type}")
    print(f"Target variables: {target_vars}")
    print(f"Learning rate scheduler: {args.lr_scheduler or 'None'}")

    model = train_era5_model(
        training_data_pairs=training_data_pairs,
        target_vars=target_vars,
        config=config,
    )

    print("ERA5 training completed!")


if __name__ == "__main__":
    main()
