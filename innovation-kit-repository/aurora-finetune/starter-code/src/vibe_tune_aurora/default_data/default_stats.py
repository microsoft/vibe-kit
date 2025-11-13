"""Default atmospheric statistics for Aurora model."""


def get_default_atmos_stats() -> dict[str, tuple[float, float]]:
    """
    Get default atmospheric statistics for pressure levels 850 and 500 hPa.

    These are approximated statistics for atmospheric variables at our pressure levels.
    In a real scenario, you'd compute these from your atmospheric data.

    Returns:
        Dictionary mapping variable names to (mean, std) tuples.
        Variables are named as "variable_pressure" (e.g., "t_850", "u_500").
    """
    atmos_stats = {}

    # Atmospheric variable statistics for each pressure level
    # Format: "variable_pressure" -> (mean, std)
    pressure_levels = [850, 500]  # Our pressure levels

    for level in pressure_levels:
        # Temperature statistics (rough estimates for different pressure levels)
        if level == 850:  # Lower atmosphere, warmer
            atmos_stats[f"t_{level}"] = (275.0, 15.0)  # ~275K ± 15K
        else:  # 500 hPa, upper atmosphere, colder
            atmos_stats[f"t_{level}"] = (245.0, 20.0)  # ~245K ± 20K

        # Wind component statistics (similar across levels)
        atmos_stats[f"u_{level}"] = (0.0, 10.0)  # Eastward wind
        atmos_stats[f"v_{level}"] = (0.0, 10.0)  # Northward wind

        # Specific humidity (higher at lower levels)
        if level == 850:
            atmos_stats[f"q_{level}"] = (0.004, 0.003)  # Higher humidity
        else:
            atmos_stats[f"q_{level}"] = (0.001, 0.001)  # Lower humidity

        # Geopotential (increases with altitude)
        if level == 850:
            atmos_stats[f"z_{level}"] = (15000.0, 3000.0)  # Lower geopotential
        else:
            atmos_stats[f"z_{level}"] = (55000.0, 8000.0)  # Higher geopotential

    print(f"Using default atmospheric statistics for {len(atmos_stats)} variables")
    return atmos_stats
