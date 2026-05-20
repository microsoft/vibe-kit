"""
Constants for Dayhoff protein sequence generation.
"""


class GenerationMode:
    """Protein sequence generation modes."""

    UNCONDITIONAL = "unconditional"
    FAMILY_GUIDED = "family_guided"
    MOTIF_SCAFFOLDING = "motif_scaffolding"

    @classmethod
    def all(cls) -> list[str]:
        return [cls.UNCONDITIONAL, cls.FAMILY_GUIDED, cls.MOTIF_SCAFFOLDING]

    @classmethod
    def is_valid(cls, mode: str) -> bool:
        return mode in cls.all()


class Direction:
    """Sequence generation direction."""

    N_TO_C = "n_to_c"  # N-terminus to C-terminus (standard)
    C_TO_N = "c_to_n"  # C-terminus to N-terminus (reverse)

    @classmethod
    def all(cls) -> list[str]:
        return [cls.N_TO_C, cls.C_TO_N]

    @classmethod
    def is_valid(cls, direction: str) -> bool:
        return direction in cls.all()


# Validation constraints
MAX_SEQUENCES = 500
MAX_LENGTH = 600
MIN_LENGTH = 10

# Default generation parameters
DEFAULT_PROMPT = "M"
DEFAULT_NUM_SEQUENCES = 3
DEFAULT_MAX_LENGTH = 512
DEFAULT_TEMPERATURE = 0.8

# Fitness scoring
NEUTRAL_SCORE = 50.0  # Default score when fitness calculation fails

# Model configuration
DEFAULT_MODEL_NAME = "microsoft/Dayhoff-170m-UR50-BRn"

# Available Dayhoff model variants — loaded at startup on a single A100.
# Research team priority models, each excels on different downstream tasks.
AVAILABLE_MODELS = {
    "3b-GR-HM-c": {
        "hf_id": "microsoft/Dayhoff-3b-GR-HM-c",
        "params": "3B",
        "description": "Best overall on ProteinGym zero-shot (single sequence + homolog conditioning)",
        "supports_homologs": True,
    },
    "3b-GR-HM": {
        "hf_id": "microsoft/Dayhoff-3b-GR-HM",
        "params": "3B",
        "description": "Strong on motif scaffolding (RFDiffusion + MotifBench)",
        "supports_homologs": True,
    },
    "3b-UR90": {
        "hf_id": "microsoft/Dayhoff-3b-UR90",
        "params": "3B",
        "description": "Highest RFDiffusion benchmark score, strong unconditional generation",
        "supports_homologs": False,
    },
    "170m-UR50-BRn": {
        "hf_id": "microsoft/Dayhoff-170m-UR50-BRn",
        "params": "170M",
        "description": "Fast, novelty-filtered BackboneRef training, good scaffolding",
        "supports_homologs": False,
    },
}
