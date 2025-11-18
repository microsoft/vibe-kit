"""PyTorch Lightning module for Aurora model training."""

from pathlib import Path
import lightning as L
import torch
from aurora import Aurora

from vibe_tune_aurora.data_processing.data_utils import load_normalization_stats, load_surface_stats
from vibe_tune_aurora.losses import compute_mae_loss as compute_mae_loss_fn
from vibe_tune_aurora.model_init import create_aurora_model

from vibe_tune_aurora.config import DEFAULT_SURF_VARS, TrainingConfig


class LitAurora(L.LightningModule):
    """Aurora model for training on real ERA5 UV/cloud data."""

    def __init__(
        self,
        surf_vars: tuple[str, ...],
        target_vars: tuple[str, ...],
        init_mode: str,
        surf_stats: dict[str, tuple[float, float]],
        norm_stats: dict[str, tuple[float, float]],
        learning_rate: float = 1e-4,
        lr_scheduler: str | None = None,
        max_epochs: int = 10,
        num_training_samples: int = 100,
        initializer_checkpoint_path: str | None = None,
    ):
        """
        Initialize Lightning module for Aurora training.

        Args:
            surf_vars: Surface variables for the Aurora model
            target_vars: Variables to compute loss over
            init_mode: Model initialization mode ('pretrained_and_custom', 'pretrained', etc.)
            surf_stats: Surface statistics for all variables
            norm_stats: Normalization statistics for target variables
            learning_rate: Learning rate for optimizer
            lr_scheduler: Learning rate scheduler type (None or 'cosine_annealing')
            max_epochs: Maximum training epochs (used for scheduler)
            num_training_samples: Number of training samples (used for scheduler)
            initializer_checkpoint_path: Path to initializer checkpoint (if init_mode requires it)
        """
        super().__init__()
        self.save_hyperparameters()

        # Create Aurora model internally
        self.model = create_aurora_model(
            init_mode=init_mode,
            surf_vars=surf_vars,
            surf_stats=surf_stats,
            initializer_checkpoint_path=initializer_checkpoint_path,
        )

        self.target_vars = target_vars
        self.norm_stats = norm_stats
        self.learning_rate = learning_rate
        self.lr_scheduler = lr_scheduler
        self.max_epochs = max_epochs
        self.num_training_samples = num_training_samples

        print(f"Target variables for MAE: {self.target_vars}")

    def forward(self, batch):
        """
        Forward pass through Aurora model.

        Args:
            batch: Input batch

        Returns:
            Model predictions
        """
        return self.model.forward(batch)

    def compute_mae_loss(self, prediction, target_batch):
        """
        Compute MAE loss over the target variables with normalization.

        This is a convenience wrapper around the unified loss function that
        automatically provides the model's target_vars, norm_stats, and device.

        Args:
            prediction: Model predictions
            target_batch: Target batch

        Returns:
            Tuple of (loss, n_vars) where n_vars is number of variables used
        """
        return compute_mae_loss_fn(
            prediction,
            target_batch,
            self.target_vars,
            self.norm_stats,
            self.device,
        )

    def training_step(self, batch, batch_idx):
        """
        Training step.

        Args:
            batch: Training batch
            batch_idx: Batch index

        Returns:
            Training loss
        """
        input_batch, target_batch = batch
        prediction = self.forward(input_batch)

        # Compute MAE loss over all variables
        loss, n_vars = self.compute_mae_loss(prediction, target_batch)

        self.log("train_loss", loss, on_step=True, on_epoch=True, prog_bar=True)
        self.log("train_n_vars", float(n_vars), prog_bar=False)

        # Log current learning rate
        current_lr = self.trainer.optimizers[0].param_groups[0]["lr"]
        self.log("learning_rate", current_lr, on_step=True, on_epoch=False, prog_bar=False)

        return loss

    def validation_step(self, batch, batch_idx):
        """
        Validation step.

        Args:
            batch: Validation batch
            batch_idx: Batch index

        Returns:
            Validation loss
        """
        input_batch, target_batch = batch
        prediction = self.forward(input_batch)

        # Compute MAE validation loss
        val_loss, n_vars = self.compute_mae_loss(prediction, target_batch)

        self.log("val_loss", val_loss, on_epoch=True, prog_bar=True)
        self.log("val_n_vars", float(n_vars), prog_bar=False)

        return val_loss

    def configure_optimizers(self):
        """
        Configure optimizer and learning rate scheduler.

        Returns:
            Optimizer or dictionary with optimizer and scheduler
        """
        optimizer = torch.optim.Adam(self.parameters(), lr=self.learning_rate)

        if self.lr_scheduler is None:
            return optimizer
        elif self.lr_scheduler == "cosine_annealing":
            # Calculate total steps and T_max for step-based scheduling
            # Update every 10 steps, so T_max is total steps divided by 10
            total_steps = self.num_training_samples * self.max_epochs
            step_frequency = 10
            T_max = total_steps // step_frequency

            scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
                optimizer,
                T_max=T_max,
                eta_min=0,
            )
            return {
                "optimizer": optimizer,
                "lr_scheduler": {
                    "scheduler": scheduler,
                    "interval": "step",
                    "frequency": step_frequency,
                },
            }
        else:
            raise ValueError(f"Unknown lr_scheduler: {self.lr_scheduler}")


def create_default_aurora_lightning_module(
    log_dir: Path,
    num_training_samples: int,
) -> LitAurora:
    """Creates a new instance of the LitAuroraUV lightning module with sensible defaults."""
    target_vars = ("2t",)
    config = TrainingConfig(
        max_epochs=1,
        learning_rate=1e-3,
        init_mode="pretrained",
        lr_scheduler="cosine_annealing",
        log_dir=log_dir,
    )

    lit_module = LitAurora(
        surf_vars=DEFAULT_SURF_VARS,
        target_vars=target_vars,
        init_mode=config.init_mode,
        surf_stats=load_surface_stats(),
        norm_stats=load_normalization_stats(target_vars),
        learning_rate=config.learning_rate,
        lr_scheduler=config.lr_scheduler,
        max_epochs=config.max_epochs,
        num_training_samples=num_training_samples,
        initializer_checkpoint_path=config.initializer_checkpoint_path,
    )

    return lit_module
