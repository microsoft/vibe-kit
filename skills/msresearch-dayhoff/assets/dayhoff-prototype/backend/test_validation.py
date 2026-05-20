"""Tests for Dayhoff prompt validation helpers."""

from app import (
    CANONICAL_AMINO_ACIDS,
    invalid_amino_acids,
    normalize_amino_acid_sequence,
    validation_error_for_prompt,
)


def test_normalize_amino_acid_sequence_removes_whitespace_and_uppercases():
    assert normalize_amino_acid_sequence("m a\nL\tW") == "MALW"


def test_validation_accepts_all_twenty_canonical_amino_acids():
    assert validation_error_for_prompt(CANONICAL_AMINO_ACIDS, max_length=600) is None


def test_validation_rejects_ambiguous_residues_with_clear_message():
    error = validation_error_for_prompt("MBOXZ", max_length=600)

    assert error is not None
    assert "B, O, X, Z are not valid amino acids" in error
    assert CANONICAL_AMINO_ACIDS in error


def test_invalid_amino_acids_deduplicates_and_sorts():
    assert invalid_amino_acids("mxbxo") == ["B", "O", "X"]


def test_validation_rejects_prompt_longer_than_generation_target():
    error = validation_error_for_prompt("A" * 11, max_length=10)

    assert error == "Prompt length 11 exceeds max length 10."
