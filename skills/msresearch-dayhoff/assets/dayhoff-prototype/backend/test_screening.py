"""Tests for Dayhoff sequence screening module.

Run: pytest backend/test_screening.py
"""

import pytest

from sequence_screening import (
    screen_sequence,
    screen_generated_sequences,
    TOXIN_SEQUENCES,
)


SAFE_SEQUENCE = "MKLLVVVAGLAVALAAQAAGVNPDEVGGEALGRLLVVYPWTQRFFESFGDLSTPDAV"
SAFE_SEQUENCE_2 = "GAVLPKLLATTLLAAGLAVVLAAQGSDEVGGEALGRLLVVYPWTQRFFESFGDLSTPDAV"


def test_normal_protein_passes():
    assert screen_sequence(SAFE_SEQUENCE) is None


@pytest.mark.parametrize("seq", ["MK", "", "ACDEFGHIKLMN"])
def test_short_sequences_skipped(seq):
    assert screen_sequence(seq) is None


@pytest.mark.parametrize("name,seq", list(TOXIN_SEQUENCES.items()))
def test_exact_match_blocks_toxin(name, seq):
    result = screen_sequence(seq)
    assert result is not None
    assert "exact_match" in result


def test_ricin_fragment_blocked_as_subsequence():
    ricin = TOXIN_SEQUENCES["ricin"]
    fragment = ricin[50:200]
    result = screen_sequence(fragment)
    assert result is not None
    assert "subsequence:ricin" in result


def test_sequence_containing_conotoxin_blocked():
    padded = "MAAAA" + TOXIN_SEQUENCES["conotoxin_alpha_gi"] + "AAAAK"
    result = screen_sequence(padded)
    assert result is not None
    assert "conotoxin" in result


def test_batch_screening_partial_block():
    ricin = TOXIN_SEQUENCES["ricin"]
    batch = [
        {"sequence": SAFE_SEQUENCE, "fitness_score": 72.0},
        {"sequence": ricin, "fitness_score": 50.0},
        {"sequence": SAFE_SEQUENCE_2, "fitness_score": 68.0},
    ]
    allowed, blocked = screen_generated_sequences(batch)
    assert len(allowed) == 2
    assert blocked == 1
    assert all(s["sequence"] != ricin for s in allowed)


def test_case_insensitive_matching():
    result = screen_sequence(TOXIN_SEQUENCES["conotoxin_alpha_gi"].lower())
    assert result is not None
    assert "conotoxin" in result


def test_all_safe_batch_returns_all():
    safe_batch = [
        {"sequence": SAFE_SEQUENCE, "fitness_score": 70.0},
        {"sequence": SAFE_SEQUENCE_2, "fitness_score": 65.0},
    ]
    allowed, blocked = screen_generated_sequences(safe_batch)
    assert len(allowed) == 2
    assert blocked == 0
