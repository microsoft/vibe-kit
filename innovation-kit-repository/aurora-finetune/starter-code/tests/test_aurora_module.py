"""
Tests for aurora_module.py
"""

from pathlib import Path
from vibe_tune_aurora.aurora_module import LitAurora, create_default_aurora_lightning_module

TESTS_DIR = Path(__file__).parent


def test_create_default_aurora_lit_module():
    lit_module = create_default_aurora_lightning_module(
        log_dir=TESTS_DIR / "outputs/tb_logs",
        num_training_samples=100,  # arbitrary num samples for this test
    )
    assert isinstance(lit_module, LitAurora)
