"""Training orchestration for Aurora fine-tuning."""

from pathlib import Path

import lightning as L
from lightning.pytorch.callbacks import ModelCheckpoint

from vibe_tune_aurora.aurora_module import LitAurora
from vibe_tune_aurora.callbacks import SaveInitCheckpoint
from vibe_tune_aurora.config import DEFAULT_SURF_VARS, TrainingConfig
from vibe_tune_aurora.data_processing.data_utils import (
    create_dataloader,
    load_normalization_stats,
    load_surface_stats,
)
from vibe_tune_aurora.types import SupervisedTrainingDataPair


def train_era5_model(
    training_data_pairs: list[SupervisedTrainingDataPair],
    validation_data_pairs: list[SupervisedTrainingDataPair],
    target_vars: tuple[str, ...],
    config: TrainingConfig | None = None,
) -> LitAurora:
    """
    Train the Aurora model on ERA5 data with sensible defaults.

    This is the main high-level training function. Most parameters have
    sensible defaults defined in TrainingConfig.

    Args:
        training_data_pairs: List of SupervisedTrainingDataPair objects for training
        target_vars: Target variables for loss computation
        config: Training configuration (uses defaults if None)

    Returns:
        Trained LitAuroraUV model
    """
    if config is None:
        config = TrainingConfig()

    # Load statistics
    surf_stats = load_surface_stats()
    norm_stats = load_normalization_stats(target_vars)

    # Create dataloaders
    train_loader = create_dataloader(training_data_pairs)
    val_loader = create_dataloader(validation_data_pairs)

    # Create Lightning module (model created internally)
    lit_model = LitAurora(
        surf_vars=DEFAULT_SURF_VARS,
        target_vars=target_vars,
        init_mode=config.init_mode,
        surf_stats=surf_stats,
        norm_stats=norm_stats,
        learning_rate=config.learning_rate,
        lr_scheduler=config.lr_scheduler,
        max_epochs=config.max_epochs,
        num_training_samples=len(train_loader),
        initializer_checkpoint_path=config.initializer_checkpoint_path,
    )

    # Create logger
    logger = L.pytorch.loggers.TensorBoardLogger(config.log_dir, name="finetuning")

    # Create callbacks
    save_init_callback = SaveInitCheckpoint()
    checkpoint_last = ModelCheckpoint(
        dirpath=None,  # Use logger's default path
        filename="last",
        save_last=True,
        save_top_k=0,  # Only save the last checkpoint
    )

    # Create trainer
    trainer = L.Trainer(
        max_epochs=config.max_epochs,
        logger=logger,
        callbacks=[save_init_callback, checkpoint_last],
        accelerator="auto",
        devices="auto",
        log_every_n_steps=2,
        val_check_interval=0.10,
    )

    # Train model
    trainer.fit(lit_model, train_loader, val_loader)

    return lit_model
