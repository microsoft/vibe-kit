"""Loss functions for Aurora model training and evaluation."""

import torch

from vibe_tune_aurora.data_processing.data_utils import normalize_tensor


def compute_mae_loss(
    prediction_batch,
    target_batch,
    target_vars: tuple[str, ...],
    norm_stats: dict[str, tuple[float, float]],
    device: str | torch.device,
) -> tuple[torch.Tensor, int]:
    """
    Compute Mean Absolute Error (MAE) loss over target variables with normalization.

    This is the single source of truth for MAE computation, used by both training
    and evaluation. The loss is computed by:
    1. Extracting predictions and targets for each variable in target_vars
    2. Normalizing both using statistics from norm_stats
    3. Computing MAE (L1 loss) between normalized values
    4. Averaging across all target variables

    Args:
        prediction_batch: Model predictions (Aurora Batch object with surf_vars dict)
        target_batch: Target batch (Aurora Batch object with surf_vars dict)
        target_vars: Tuple of target variable names to compute loss over
        norm_stats: Normalization statistics mapping variable names to (mean, std) tuples
        device: Device for loss accumulator tensor. Should match device of prediction_batch
                (typically model.device). If device mismatch occurs, will raise RuntimeError.

    Returns:
        Tuple of (loss, n_vars) where:
        - loss: MAE loss as torch.Tensor on specified device (call .item() for float)
        - n_vars: Number of variables actually used in computation

    Raises:
        RuntimeError: If device mismatch between accumulator and prediction tensors
        ValueError: If normalization statistics not available for a variable

    Example:
        >>> # In training (returns tensor for backprop)
        >>> loss, n_vars = compute_mae_loss(pred, target, ("tcc", "uvb"),
        ...                                  norm_stats, model.device)
        >>> loss.backward()
        >>>
        >>> # In evaluation (convert to float for statistics)
        >>> loss_tensor, n_vars = compute_mae_loss(pred, target, ("tcc", "uvb"),
        ...                                         norm_stats, model.device)
        >>> loss = loss_tensor.item()
    """
    total_loss = torch.tensor(0.0, device=device)
    n_vars = 0

    # Surface variables loss for target variables only
    for var_name in target_vars:
        if var_name in prediction_batch.surf_vars and var_name in target_batch.surf_vars:
            pred_var = prediction_batch.surf_vars[var_name]
            target_var = target_batch.surf_vars[var_name]

            # Normalize both prediction and target
            pred_normalized = normalize_tensor(pred_var, var_name, norm_stats)
            target_normalized = normalize_tensor(target_var, var_name, norm_stats)

            # Compute MAE loss on normalized values
            loss = torch.nn.functional.l1_loss(pred_normalized, target_normalized)
            total_loss += loss
            n_vars += 1

    # Average loss across target variables
    if n_vars > 0:
        total_loss = total_loss / n_vars

    return total_loss, n_vars
