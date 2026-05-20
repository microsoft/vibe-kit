"""
Default configurations for Aurora model
"""

from pathlib import Path
from dataclasses import dataclass

PROJECT_ROOT = Path(__file__).parent.parent.parent
DEFAULT_STATS_FILE = PROJECT_ROOT / "../tests/inputs/era5_surface_stats.json"

DEFAULT_SURFACE_VARIABLE_NAMES = (
    "2t",  # 2 meter temperature
    "10u",  # 10 meter eastward wind speed
    "10v",  # 10 meter southward wind speed
    "msl",  # Mean sea level pressure
)
DEFAULT_STATIC_VARIABLE_NAMES = (
    "slt",  # soil type
    "z",  # surface level geopotential
    "lsm",  # Land-sea mask
)
DEFAULT_ATMOSPHERIC_VARIABLE_NAMES = (
    "t",  # Temperature
    "u",  # eastward wind speed
    "v",  # southward wind speed
    "z",  # geopotential
    "q",  # specific humidity
)

# Target variable presets mapping loss types to target variables
TARGET_VAR_PRESETS = {
    "4_vars": ("tcc", "tclw", "uvb", "ssrdc"),
    "2_cloud_vars": ("tcc", "tclw"),
    "2t_var": ("2t",),
    "uvb_var": ("uvb",),
    "tcc_var": ("tcc",),
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
