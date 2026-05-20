"""Deterministic IUPAC systematic naming for inorganic compounds.

Uses pymatgen's oxidation state guessing and element data to generate
proper IUPAC systematic names like "Iron(III) oxide" from compositions.

This module provides fully deterministic naming based on:
1. Oxidation state inference from pymatgen
2. IUPAC nomenclature rules for inorganic compounds
3. Polyatomic anion detection (sulfate, nitrate, phosphate, etc.)
4. Proper cation/anion ordering by electronegativity
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from pymatgen.core import Composition, Element

if TYPE_CHECKING:
    from pymatgen.core import Structure

logger = logging.getLogger(__name__)


# =============================================================================
# IUPAC Naming Data Tables
# =============================================================================

# Elements that typically have only one common oxidation state in compounds.
# These do NOT require Roman numerals in their names.
# e.g., "Sodium chloride" not "Sodium(I) chloride"
SINGLE_OXIDATION_METALS: dict[str, int] = {
    # Alkali metals (always +1)
    "Li": 1,
    "Na": 1,
    "K": 1,
    "Rb": 1,
    "Cs": 1,
    "Fr": 1,
    # Alkaline earth metals (always +2)
    "Be": 2,
    "Mg": 2,
    "Ca": 2,
    "Sr": 2,
    "Ba": 2,
    "Ra": 2,
    # Other metals with single common oxidation state
    "Al": 3,  # Aluminum is always +3
    "Zn": 2,  # Zinc is always +2
    "Ag": 1,  # Silver is almost always +1
    "Cd": 2,  # Cadmium is always +2
    "Sc": 3,  # Scandium is always +3
    "Y": 3,  # Yttrium is always +3
}

# Monatomic anion names: element symbol -> "-ide" form
ANION_IDE_NAMES: dict[str, str] = {
    # Chalcogens (Group 16)
    "O": "oxide",
    "S": "sulfide",
    "Se": "selenide",
    "Te": "telluride",
    # Halogens (Group 17)
    "F": "fluoride",
    "Cl": "chloride",
    "Br": "bromide",
    "I": "iodide",
    # Pnictogens (Group 15)
    "N": "nitride",
    "P": "phosphide",
    "As": "arsenide",
    "Sb": "antimonide",
    # Other nonmetals
    "C": "carbide",
    "Si": "silicide",
    "H": "hydride",
    "B": "boride",
}

# Polyatomic anion patterns.
# Key: (central_element, oxygen_count, central_oxidation_state)
# Value: anion name
# These are detected when a nonmetal has a positive oxidation state bonded to oxygen.
POLYATOMIC_ANIONS: dict[tuple[str, int, int], str] = {
    # Sulfur oxyanions
    ("S", 4, 6): "sulfate",  # SO4^2- (sulfur +6)
    ("S", 3, 4): "sulfite",  # SO3^2- (sulfur +4)
    # Nitrogen oxyanions
    ("N", 3, 5): "nitrate",  # NO3^- (nitrogen +5)
    ("N", 2, 3): "nitrite",  # NO2^- (nitrogen +3)
    # Phosphorus oxyanions
    ("P", 4, 5): "phosphate",  # PO4^3- (phosphorus +5)
    ("P", 3, 3): "phosphite",  # PO3^3- (phosphorus +3)
    # Carbon oxyanions
    ("C", 3, 4): "carbonate",  # CO3^2- (carbon +4)
    # Chlorine oxyanions
    ("Cl", 4, 7): "perchlorate",  # ClO4^- (chlorine +7)
    ("Cl", 3, 5): "chlorate",  # ClO3^- (chlorine +5)
    ("Cl", 2, 3): "chlorite",  # ClO2^- (chlorine +3)
    ("Cl", 1, 1): "hypochlorite",  # ClO^- (chlorine +1)
    # Bromine oxyanions
    ("Br", 4, 7): "perbromate",  # BrO4^- (bromine +7)
    ("Br", 3, 5): "bromate",  # BrO3^- (bromine +5)
    # Iodine oxyanions
    ("I", 4, 7): "periodate",  # IO4^- (iodine +7)
    ("I", 3, 5): "iodate",  # IO3^- (iodine +5)
    # Transition metal oxyanions
    ("Mn", 4, 7): "permanganate",  # MnO4^- (manganese +7)
    ("Cr", 4, 6): "chromate",  # CrO4^2- (chromium +6)
    ("Cr", 7, 6): "dichromate",  # Cr2O7^2- (chromium +6, 7 oxygens per 2 Cr)
    ("Mo", 4, 6): "molybdate",  # MoO4^2- (molybdenum +6)
    ("W", 4, 6): "tungstate",  # WO4^2- (tungsten +6)
    ("V", 4, 5): "vanadate",  # VO4^3- (vanadium +5)
    # Silicon oxyanions
    ("Si", 4, 4): "silicate",  # SiO4^4- (silicon +4)
    ("Si", 3, 4): "metasilicate",  # SiO3^2- (silicon +4)
    # Boron oxyanions
    ("B", 3, 3): "borate",  # BO3^3- (boron +3)
    # Arsenic/Antimony oxyanions
    ("As", 4, 5): "arsenate",  # AsO4^3- (arsenic +5)
    ("Sb", 4, 5): "antimonate",  # SbO4^3- (antimony +5)
}

# Elements that form polyatomic anions (central atoms in oxyanions)
POLYATOMIC_CENTRAL_ELEMENTS: set[str] = {
    "S",
    "N",
    "P",
    "C",
    "Cl",
    "Br",
    "I",
    "Mn",
    "Cr",
    "Mo",
    "W",
    "V",
    "Si",
    "B",
    "As",
    "Sb",
}

# Common anion oxidation states for heuristic naming
# Used when pymatgen can't determine oxidation states
COMMON_ANION_OXIDATION_STATES: dict[str, int] = {
    # Halogens (always -1)
    "F": -1,
    "Cl": -1,
    "Br": -1,
    "I": -1,
    # Chalcogens (typically -2)
    "O": -2,
    "S": -2,
    "Se": -2,
    "Te": -2,
    # Pnictogens (typically -3)
    "N": -3,
    "P": -3,
    "As": -3,
    # Other
    "C": -4,
    "H": -1,  # In metal hydrides
}


# =============================================================================
# Helper Functions
# =============================================================================


def _to_roman(n: int) -> str:
    """Convert a positive integer to Roman numeral representation.

    Args:
        n: Positive integer (typically 1-7 for oxidation states)

    Returns:
        Roman numeral string (e.g., 3 -> "III")
    """
    if n <= 0:
        return str(n)

    numerals = [(10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]
    result = ""
    for value, numeral in numerals:
        while n >= value:
            result += numeral
            n -= value
    return result


def _get_element_name(symbol: str) -> str:
    """Get the full English name of an element.

    Args:
        symbol: Element symbol (e.g., "Fe")

    Returns:
        Element name in lowercase (e.g., "iron")
    """
    try:
        return Element(symbol).long_name.lower()
    except Exception:
        return symbol.lower()


def _format_cation_name(symbol: str, oxidation_state: int) -> str:
    """Format a cation name with optional Roman numeral.

    Args:
        symbol: Element symbol
        oxidation_state: Positive oxidation state

    Returns:
        Formatted cation name (e.g., "Iron(III)" or "Sodium")
    """
    name = _get_element_name(symbol)

    # Check if this element needs a Roman numeral
    if symbol in SINGLE_OXIDATION_METALS:
        # No Roman numeral needed for elements with single common oxidation state
        return name.capitalize()
    else:
        # Add Roman numeral for variable oxidation state metals
        roman = _to_roman(int(oxidation_state))
        return f"{name.capitalize()}({roman})"


def _format_anion_name(symbol: str) -> str:
    """Format a monatomic anion name with -ide suffix.

    Args:
        symbol: Element symbol

    Returns:
        Anion name (e.g., "oxide", "chloride")
    """
    if symbol in ANION_IDE_NAMES:
        return ANION_IDE_NAMES[symbol]

    # Fallback: use element name + "ide"
    name = _get_element_name(symbol)
    # Remove trailing vowels and add -ide
    if name.endswith(("en", "ine", "ogen")):
        # nitrogen -> nitride, chlorine -> chloride, oxygen -> oxide
        if name.endswith("ogen"):
            return name[:-4] + "ide"
        elif name.endswith("ine"):
            return name[:-3] + "ide"
        elif name.endswith("en"):
            return name[:-2] + "ide"
    return name + "ide"


def _detect_polyatomic_anion(
    oxi_states: dict[str, float],
    composition: Composition,
) -> tuple[str | None, set[str]]:
    """Detect if the composition contains a polyatomic anion.

    Args:
        oxi_states: Dictionary of element -> oxidation state
        composition: The pymatgen Composition object

    Returns:
        Tuple of (anion_name, elements_in_anion) or (None, empty_set)
    """
    # Look for patterns where a nonmetal has positive oxidation state + oxygen
    if "O" not in oxi_states or oxi_states["O"] >= 0:
        return None, set()

    # Get the reduced formula amounts
    el_amounts = composition.get_el_amt_dict()

    for central_el in POLYATOMIC_CENTRAL_ELEMENTS:
        if central_el not in oxi_states:
            continue

        central_oxi = oxi_states[central_el]
        if central_oxi <= 0:
            continue  # Central atom must be positive in oxyanions

        # Calculate oxygen ratio relative to central element
        if central_el not in el_amounts:
            continue

        central_amt = el_amounts[central_el]
        oxygen_amt = el_amounts.get("O", 0)

        if central_amt == 0:
            continue

        # Calculate oxygen per central atom
        oxygen_per_central = oxygen_amt / central_amt

        # Round to nearest integer for matching
        oxygen_count = round(oxygen_per_central)
        central_oxi_int = round(central_oxi)

        # Look up in polyatomic anion table
        key = (central_el, oxygen_count, central_oxi_int)
        if key in POLYATOMIC_ANIONS:
            return POLYATOMIC_ANIONS[key], {central_el, "O"}

    return None, set()


def _is_all_metals(composition: Composition) -> bool:
    """Check if a composition contains only metallic elements.

    Args:
        composition: pymatgen Composition object

    Returns:
        True if all elements are metals (including metalloids like Si, Ge)
    """
    elements = list(composition.get_el_amt_dict().keys())
    for el in elements:
        element = Element(el)
        # Consider metalloids as non-metals for naming purposes
        if not element.is_metal or element.is_metalloid:
            return False
    return True


def _format_intermetallic_name(composition: Composition) -> str:
    """Format a name for intermetallic/alloy compounds (all metals).

    For compounds containing only metals, we just list element names
    sorted by electronegativity (lower/more metallic first).

    Args:
        composition: pymatgen Composition object

    Returns:
        Name like "Iron cobalt" or "Thulium gallium palladium"
    """
    elements = list(composition.get_el_amt_dict().keys())

    # Sort by electronegativity (lower first = more metallic)
    try:
        elements.sort(key=lambda x: Element(x).X)
    except Exception:
        pass  # Keep original order if sorting fails

    # Get element names
    names = [_get_element_name(el).capitalize() for el in elements]

    # Join with spaces, all lowercase except first
    if names:
        return names[0] + " " + " ".join(n.lower() for n in names[1:])
    return ""


def _format_heuristic_name(composition: Composition) -> str:
    """Format a name using heuristic oxidation state assumptions.

    Used when pymatgen can't determine oxidation states but the compound
    contains nonmetals that are likely anions.

    Args:
        composition: pymatgen Composition object

    Returns:
        Name like "Lithium cadmium bromide" or "Iron cobalt nitride"
    """
    el_amounts = composition.get_el_amt_dict()
    elements = list(el_amounts.keys())

    # Separate into likely cations (metals) and anions (nonmetals)
    cations: list[str] = []
    anions: list[str] = []

    for el in elements:
        element = Element(el)
        if el in COMMON_ANION_OXIDATION_STATES and not element.is_metal:
            anions.append(el)
        else:
            cations.append(el)

    # Sort cations by electronegativity (lower first)
    try:
        cations.sort(key=lambda x: Element(x).X)
    except Exception:
        pass

    # Sort anions by electronegativity (higher first - more electronegative anions first)
    try:
        anions.sort(key=lambda x: -Element(x).X)
    except Exception:
        pass

    name_parts: list[str] = []

    # Add cation names (without oxidation states since we don't know them confidently)
    for el in cations:
        name_parts.append(_get_element_name(el).capitalize())

    # Add anion names with -ide suffix
    for el in anions:
        name_parts.append(_format_anion_name(el))

    if not name_parts:
        return composition.reduced_formula

    # Format: first word capitalized, rest lowercase
    result = name_parts[0]
    for part in name_parts[1:]:
        result += " " + part.lower()

    return result

    # Get the reduced formula amounts
    el_amounts = composition.get_el_amt_dict()

    for central_el in POLYATOMIC_CENTRAL_ELEMENTS:
        if central_el not in oxi_states:
            continue

        central_oxi = oxi_states[central_el]
        if central_oxi <= 0:
            continue  # Central atom must be positive in oxyanions

        # Calculate oxygen ratio relative to central element
        if central_el not in el_amounts:
            continue

        central_amt = el_amounts[central_el]
        oxygen_amt = el_amounts.get("O", 0)

        if central_amt == 0:
            continue

        # Calculate oxygen per central atom
        oxygen_per_central = oxygen_amt / central_amt

        # Round to nearest integer for matching
        oxygen_count = round(oxygen_per_central)
        central_oxi_int = round(central_oxi)

        # Look up in polyatomic anion table
        key = (central_el, oxygen_count, central_oxi_int)
        if key in POLYATOMIC_ANIONS:
            return POLYATOMIC_ANIONS[key], {central_el, "O"}

    return None, set()


# =============================================================================
# Main Naming Functions
# =============================================================================


def get_systematic_name(
    composition: Composition | Structure | str,
    fallback_to_formula: bool = True,
) -> str:
    """Generate IUPAC systematic name for a composition.

    This function produces deterministic, IUPAC-compliant names for inorganic
    compounds based on their composition and inferred oxidation states.

    Handles special cases:
    - Pure elements: Returns element name (e.g., "Iron")
    - Intermetallics: Returns element names (e.g., "Iron cobalt")
    - Complex compounds: Uses heuristic naming when oxidation states unclear

    Args:
        composition: pymatgen Composition, Structure, or formula string
        fallback_to_formula: If True, return the formula when naming fails

    Returns:
        IUPAC systematic name (e.g., "Iron(III) oxide") or formula as fallback

    Examples:
        >>> get_systematic_name("Fe2O3")
        "Iron(III) oxide"
        >>> get_systematic_name("NaCl")
        "Sodium chloride"
        >>> get_systematic_name("CuSO4")
        "Copper(II) sulfate"
        >>> get_systematic_name("FeCo")
        "Iron cobalt"
        >>> get_systematic_name("Fe")
        "Iron"
    """
    # Handle different input types
    if isinstance(composition, str):
        try:
            composition = Composition(composition)
        except Exception as e:
            logger.warning(f"Failed to parse formula '{composition}': {e}")
            return composition if fallback_to_formula else ""
    elif hasattr(composition, "composition"):
        # It's a Structure object
        composition = composition.composition

    # Get reduced formula for fallback
    try:
        formula = composition.reduced_formula
    except Exception:
        formula = str(composition)

    # Get element list
    elements = list(composition.get_el_amt_dict().keys())

    # === SPECIAL CASE 1: Pure elements ===
    if len(elements) == 1:
        return _get_element_name(elements[0]).capitalize()

    # === SPECIAL CASE 2: All-metal compounds (intermetallics/alloys) ===
    if _is_all_metals(composition):
        return _format_intermetallic_name(composition)

    # === STANDARD CASE: Try oxidation state guessing ===
    try:
        oxi_guesses = composition.oxi_state_guesses()
    except Exception as e:
        logger.warning(f"Oxidation state guessing failed for {formula}: {e}")
        # Fall through to heuristic naming
        oxi_guesses = []

    # If no oxidation state guesses, use heuristic naming
    if not oxi_guesses:
        logger.debug(
            f"No oxidation state guesses for {formula}, using heuristic naming"
        )
        return _format_heuristic_name(composition)

    # Use the most probable oxidation state assignment
    oxi_states = oxi_guesses[0]

    # Separate cations (positive) and potential anions (negative or polyatomic central)
    cations: dict[str, float] = {}
    simple_anions: dict[str, float] = {}

    for el, oxi in oxi_states.items():
        if oxi > 0:
            cations[el] = oxi
        elif oxi < 0:
            simple_anions[el] = oxi

    # Check for polyatomic anions
    polyatomic_name, polyatomic_elements = _detect_polyatomic_anion(
        oxi_states, composition
    )

    # Build the name
    name_parts: list[str] = []

    # 1. Add cation names (excluding elements that are part of polyatomic anion)
    # Sort cations by electronegativity (lower first - more metallic)
    cation_items = [
        (el, oxi)
        for el, oxi in cations.items()
        if el not in polyatomic_elements or el == "O"  # Keep non-polyatomic cations
    ]
    # Actually filter out polyatomic central elements from cations
    cation_items = [
        (el, oxi) for el, oxi in cations.items() if el not in polyatomic_elements
    ]

    # Sort by electronegativity (metals first)
    try:
        cation_items.sort(key=lambda x: Element(x[0]).X)
    except Exception:
        pass  # Keep original order if sorting fails

    # Check for mixed valence (e.g., Fe3O4 has Fe2+ and Fe3+)
    # For now, just use the average/dominant state
    for el, oxi in cation_items:
        name_parts.append(_format_cation_name(el, int(oxi)))

    # 2. Add anion name
    if polyatomic_name:
        # Use polyatomic anion name
        name_parts.append(polyatomic_name)
    else:
        # Use simple anion names
        # Sort anions by electronegativity (higher first for naming convention)
        anion_items = list(simple_anions.items())
        try:
            anion_items.sort(key=lambda x: -Element(x[0]).X)
        except Exception:
            pass

        for el, oxi in anion_items:
            name_parts.append(_format_anion_name(el))

    # If we couldn't build any name parts, fall back to heuristic
    if not name_parts:
        return _format_heuristic_name(composition)

    # Join with spaces
    result = " ".join(name_parts)

    # Handle edge case: if we somehow got an empty result
    if not result.strip():
        return _format_heuristic_name(composition)

    return result


def get_systematic_name_safe(
    composition: Composition | Structure | str,
) -> str | None:
    """Generate IUPAC systematic name, returning None on failure.

    This is a safer version that returns None instead of falling back
    to the formula, useful when you want to explicitly handle failures.

    Args:
        composition: pymatgen Composition, Structure, or formula string

    Returns:
        IUPAC systematic name or None if naming failed
    """
    result = get_systematic_name(composition, fallback_to_formula=False)
    return result if result else None
