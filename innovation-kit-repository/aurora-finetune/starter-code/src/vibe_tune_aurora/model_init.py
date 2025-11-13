"""Model initialization strategies for Aurora fine-tuning."""

import math

import torch
from torch import nn
from aurora import Aurora, AuroraSmall


def _add_custom_variables_to_pretrained(
    model: Aurora,
    surf_vars: tuple[str, ...],
    surf_stats: dict[str, tuple[float, float]],
) -> None:
    """
    Add custom surface variables to a pretrained Aurora model.

    Modifies the model in-place by adding embedding weights and decoder heads
    for new variables not in the pretrained model.

    Args:
        model: Pretrained Aurora model to modify
        surf_vars: Custom surface variables to use
        surf_stats: Surface statistics for all variables
    """
    pretrained_surf_vars = model.surf_vars
    model.surf_vars = surf_vars
    model.surf_stats = surf_stats

    new_var_names = set(surf_vars) - set(pretrained_surf_vars)

    for new_var_name in new_var_names:
        model.encoder.surf_token_embeds.weights[new_var_name] = nn.Parameter(
            torch.empty_like(model.encoder.surf_token_embeds.weights["2t"])
        )
        # Initialize the weight with kaiming uniform, identical to how the Aurora SDK does it
        nn.init.kaiming_uniform_(
            model.encoder.surf_token_embeds.weights[new_var_name],
            a=math.sqrt(5),
        )

        model.decoder.surf_heads[new_var_name] = nn.Linear(
            model.decoder.embed_dim,
            model.decoder.patch_size**2,
        )


def init_pretrained_and_custom(
    surf_vars: tuple[str, ...],
    surf_stats: dict[str, tuple[float, float]],
) -> Aurora:
    """
    Initialize Aurora with pretrained weights and custom surface variables.

    Loads pretrained Aurora model and adds any custom surface variables
    not present in the pretrained model.

    Args:
        surf_vars: Custom surface variables
        surf_stats: Surface statistics for variables

    Returns:
        Initialized Aurora model with pretrained weights and custom variables
    """
    model = AuroraSmall()
    model.load_checkpoint("microsoft/aurora", "aurora-0.25-small-pretrained.ckpt")

    _add_custom_variables_to_pretrained(model, surf_vars, surf_stats)

    print(f"Initialized Aurora model with custom surface variables: {surf_vars}")
    print(f"Surface statistics keys: {list(surf_stats.keys())}")

    return model


def init_pretrained() -> Aurora:
    """
    Initialize Aurora with pretrained weights and default parameters.

    Returns:
        Pretrained Aurora model with default configuration
    """
    model = AuroraSmall()
    model.load_checkpoint("microsoft/aurora", "aurora-0.25-small-pretrained.ckpt")
    print("Initialized Aurora model with default parameters (for rollout comparison)")
    return model


def init_from_scratch(
    surf_vars: tuple[str, ...],
    surf_stats: dict[str, tuple[float, float]],
) -> Aurora:
    """
    Initialize Aurora with random weights and custom surface variables.

    Args:
        surf_vars: Custom surface variables
        surf_stats: Surface statistics for variables

    Returns:
        Aurora model with random initialization
    """
    model = AuroraSmall(
        surf_vars=surf_vars,
        surf_stats=surf_stats,
    )
    print(f"Initialized Aurora model with custom surface variables and random weights: {surf_vars}")
    print(f"Surface statistics keys: {list(surf_stats.keys())}")
    return model


def init_from_checkpoint(checkpoint_path: str) -> Aurora:
    """
    Load Aurora model from a custom checkpoint.

    Args:
        checkpoint_path: Path to Lightning checkpoint file

    Returns:
        Aurora model loaded from checkpoint
    """
    # Import here to avoid circular dependency
    from .aurora_module import LitAurora

    lightning_model = LitAurora.load_from_checkpoint(checkpoint_path)
    model = lightning_model.model
    assert isinstance(model, Aurora)

    print(f"Loaded Aurora model from initializer checkpoint: {checkpoint_path}")
    print(f"Surface variables: {model.surf_vars}")

    return model


def create_aurora_model(
    init_mode: str,
    surf_vars: tuple[str, ...],
    surf_stats: dict[str, tuple[float, float]],
    initializer_checkpoint_path: str | None = None,
) -> Aurora:
    """
    Create and initialize Aurora model based on specified mode.

    Args:
        init_mode: One of 'pretrained_and_custom', 'pretrained',
                  'initialized_and_custom', 'initializer_checkpoint'
        surf_vars: Surface variables to use
        surf_stats: Surface statistics for all variables
        initializer_checkpoint_path: Path to checkpoint (required for 'initializer_checkpoint' mode)

    Returns:
        Initialized Aurora model

    Raises:
        ValueError: If init_mode is invalid or checkpoint path is missing when required
    """
    match init_mode:
        case "pretrained_and_custom":
            return init_pretrained_and_custom(surf_vars, surf_stats)
        case "pretrained":
            return init_pretrained()
        case "initialized_and_custom":
            return init_from_scratch(surf_vars, surf_stats)
        case "initializer_checkpoint":
            if initializer_checkpoint_path is None:
                raise ValueError(
                    "initializer_checkpoint_path must be provided when init_mode is 'initializer_checkpoint'"
                )
            return init_from_checkpoint(initializer_checkpoint_path)
        case _:
            raise ValueError(
                f"Invalid init_mode: {init_mode}. Must be one of: 'pretrained_and_custom', 'pretrained', 'initialized_and_custom', 'initializer_checkpoint'"
            )
