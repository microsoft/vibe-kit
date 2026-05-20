"""PyTorch Lightning callbacks for Aurora fine-tuning."""

from pathlib import Path

from lightning.pytorch.callbacks import Callback


class SaveInitCheckpoint(Callback):
    """Callback to save initial model checkpoint before training starts."""

    def on_fit_start(self, trainer, pl_module):
        """
        Save initial checkpoint when training begins.

        Args:
            trainer: PyTorch Lightning trainer
            pl_module: Lightning module being trained
        """
        ckpt_dir = Path(trainer.logger.log_dir) / "checkpoints"
        ckpt_dir.mkdir(parents=True, exist_ok=True)
        init_checkpoint_path = ckpt_dir / "init.ckpt"
        trainer.save_checkpoint(init_checkpoint_path)
        print(f"Saved initial checkpoint to: {init_checkpoint_path}")
