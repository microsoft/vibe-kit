"""Dataset and data loading utilities for Aurora fine-tuning."""

import json
from pathlib import Path

import torch
from torch.utils.data import DataLoader, Dataset

from vibe_tune_aurora.config import DEFAULT_STATS_FILE
from vibe_tune_aurora.types import SupervisedTrainingDataPair


class ERA5Dataset(Dataset):
    """Dataset for loading ERA5 training data."""

    def __init__(self, training_data_pairs: list[SupervisedTrainingDataPair]):
        """
        Initialize ERA5 dataset from list of training data pairs.

        Args:
            training_data_pairs: List of SupervisedTrainingDataPair objects
        """
        self.training_data = training_data_pairs
        print(f"Loaded {len(self.training_data)} training samples")

    def __len__(self) -> int:
        """Return number of samples in dataset."""
        return len(self.training_data)

    def __getitem__(self, idx: int):
        """
        Get a single sample from the dataset.

        Args:
            idx: Index of sample to retrieve

        Returns:
            Tuple of (input_batch, target_batch)
        """
        sample = self.training_data[idx]
        input_batch = sample.input_batch
        target_batch = sample.target_batch
        return input_batch, target_batch


def load_surface_stats(
    stats_file: Path = DEFAULT_STATS_FILE,
) -> dict[str, tuple[float, float]]:
    """
    Load surface statistics from JSON file.

    Args:
        stats_file: Path to JSON file containing surface statistics.
                   Defaults to tests/data/era5_surface_stats.json

    Returns:
        Dictionary mapping variable names to (mean, std) tuples

    Raises:
        FileNotFoundError: If statistics file doesn't exist
    """
    if not stats_file.exists():
        raise FileNotFoundError(f"Surface statistics file not found: {stats_file}")

    with open(stats_file, "r") as f:
        stats_json = json.load(f)

    # Convert from JSON format to tuple format
    surf_stats = {}
    for var_name, stats in stats_json.items():
        surf_stats[var_name] = (stats["mean"], stats["std"])

    print(f"Loaded surface statistics for {len(surf_stats)} variables")
    return surf_stats


def load_normalization_stats(
    target_vars: tuple[str, ...],
    stats_file: Path = DEFAULT_STATS_FILE,
) -> dict[str, tuple[float, float]]:
    """
    Load normalization statistics for target variables from JSON file.

    Args:
        target_vars: Tuple of target variable names to load statistics for
        stats_file: Path to JSON file containing statistics.
                   Defaults to tests/data/era5_surface_stats.json

    Returns:
        Dictionary mapping target variable names to (mean, std) tuples

    Raises:
        FileNotFoundError: If statistics file doesn't exist
        ValueError: If statistics not found for any target variable
    """
    if not stats_file.exists():
        raise FileNotFoundError(f"Normalization statistics file not found: {stats_file}")

    with open(stats_file, "r") as f:
        stats_json = json.load(f)

    # Convert from JSON format to tuple format for target variables only
    norm_stats = {}
    for var_name in target_vars:
        if var_name in stats_json:
            stats = stats_json[var_name]
            norm_stats[var_name] = (stats["mean"], stats["std"])
        else:
            raise ValueError(f"Normalization statistics not found for variable: {var_name}")

    print(f"Loaded normalization statistics for {len(norm_stats)} target variables")
    return norm_stats


def normalize_tensor(
    tensor: torch.Tensor,
    var_name: str,
    norm_stats: dict[str, tuple[float, float]],
) -> torch.Tensor:
    """
    Normalize tensor using provided statistics.

    Args:
        tensor: Tensor to normalize
        var_name: Variable name to get statistics for
        norm_stats: Dictionary mapping variable names to (mean, std) tuples

    Returns:
        Normalized tensor: (tensor - mean) / std

    Raises:
        ValueError: If no statistics available for variable
    """
    if var_name not in norm_stats:
        raise ValueError(f"No normalization statistics available for variable: {var_name}")

    mean, std = norm_stats[var_name]
    return (tensor - mean) / std


def create_era5_dataloaders(
    training_data_pairs: list[SupervisedTrainingDataPair],
    batch_size: int = 1,
    train_ratio: float = 0.8,
) -> tuple[DataLoader, DataLoader]:
    """
    Create train and validation dataloaders from ERA5 training data.

    Args:
        training_data_pairs: List of SupervisedTrainingDataPair objects
        batch_size: Batch size (must be 1 for Aurora Batch objects)
        train_ratio: Ratio of data to use for training vs validation

    Returns:
        Tuple of (train_loader, val_loader)

    Raises:
        ValueError: If batch_size is not 1 (Aurora Batch objects only support batch_size=1)
    """
    # Aurora Batch objects only support batch_size=1
    if batch_size != 1:
        raise ValueError("Only batch_size=1 is supported for Aurora Batch objects")

    # Load dataset
    dataset = ERA5Dataset(training_data_pairs)

    # Split into train and validation
    n_train = int(len(dataset) * train_ratio)
    n_val = len(dataset) - n_train

    train_dataset, val_dataset = torch.utils.data.random_split(
        dataset, [n_train, n_val], generator=torch.Generator().manual_seed(42)
    )

    print(f"Train samples: {len(train_dataset)}, Validation samples: {len(val_dataset)}")

    # Custom collate function for Batch objects
    def collate_batch_objects(batch_list):
        """Custom collate function for Aurora Batch objects."""
        if len(batch_list) != 1:
            raise ValueError(
                f"Only batch_size=1 is supported for Batch objects, got {len(batch_list)} samples"
            )
        return batch_list[0]

    # Create dataloaders
    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=0,
        collate_fn=collate_batch_objects,
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=0,
        collate_fn=collate_batch_objects,
    )

    return train_loader, val_loader
