"""
Defines commonly used types/dataclasses used among the source code
"""

from dataclasses import dataclass
import aurora


@dataclass
class SupervisedTrainingDataPair:
    input_batch: aurora.Batch
    target_batch: aurora.Batch
