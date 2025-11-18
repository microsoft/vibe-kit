"""Configuration and constants for Aurora fine-tuning."""

from pathlib import Path
from dataclasses import dataclass


# Project paths
PROJECT_ROOT = Path(__file__).parent.parent.parent
DEFAULT_STATS_FILE = PROJECT_ROOT / "tests/inputs/era5_surface_stats.json"

# Surface variables
DEFAULT_SURF_VARS = ("2t", "10u", "10v", "msl", "tcc", "tclw", "uvb", "ssrdc")

# Target variable presets mapping loss types to target variables
TARGET_VAR_PRESETS = {
    "4_vars": ("tcc", "tclw", "uvb", "ssrdc"),
    "2_cloud_vars": ("tcc", "tclw"),
    "2t_var": ("2t",),
    "uvb_var": ("uvb",),
}


@dataclass
class TrainingConfig:
    """Configuration for Aurora model training with sensible defaults."""

    log_dir: Path | None = None
    max_epochs: int = 3
    learning_rate: float = 1e-6
    batch_size: int = 1  # Aurora Batch objects only support batch_size=1
    init_mode: str = "pretrained_and_custom"
    lr_scheduler: str | None = "cosine_annealing"
    initializer_checkpoint_path: str | None = None
