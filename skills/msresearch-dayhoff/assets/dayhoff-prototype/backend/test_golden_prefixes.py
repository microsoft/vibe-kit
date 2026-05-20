"""
Golden-prefix regression tests for the Dayhoff API (proxy mode).

These test the Flask app's validation, routing, and response structure
without requiring a live Azure ML endpoint. Tests that require the
scoring endpoint are marked with a skip condition.

Run: pytest test_golden_prefixes.py -v
"""

import json
import pytest
from unittest.mock import patch, MagicMock

from app import create_app, CANONICAL_AMINO_ACIDS
from constants import AVAILABLE_MODELS, GenerationMode, Direction

# ── Golden example prefixes (must match frontend EXAMPLES) ──
GOLDEN_PREFIXES = {
    "cas9": "MDKKYSIGLDIGTNSVGWAVITDEYKVPSKKFKVLGNTDRHSIKKNLIGALLFDSG",
    "insulin": "MALWMRLLPLLALLALWGPDPAAAFVNQHLCGSHLVEALYLVCGERGFFYTPKT",
    "dna_polymerase": "MSKRKAPQETLNGGITDMLTELANFEKNVSQAIHK",
    "spike": "MFVFLVLLPLVSSQCVNLTTRTQLPPAYTNSFTRGVYYPDKVFRSSVLHSTQDLFLPFF",
    "de_novo": "",
}


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


# ── Health endpoint ──


def test_health_returns_available_models(client):
    resp = client.get("/api/health")
    data = resp.get_json()
    assert resp.status_code == 200
    assert "available_models" in data
    assert set(data["available_models"]) == set(AVAILABLE_MODELS.keys())


# ── Input validation (no endpoint needed) ──


@pytest.mark.parametrize("name,prefix", GOLDEN_PREFIXES.items())
def test_golden_prefix_contains_only_canonical_amino_acids(name, prefix):
    """Every golden prefix must consist solely of the 20 canonical AAs."""
    invalid = [c for c in prefix if c not in CANONICAL_AMINO_ACIDS]
    assert invalid == [], f"{name} prefix contains non-canonical residues: {invalid}"


@pytest.mark.parametrize("name,prefix", GOLDEN_PREFIXES.items())
def test_golden_prefix_accepted_by_validate_endpoint(client, name, prefix):
    """The /api/validate endpoint must accept all golden prefixes."""
    if not prefix:
        pytest.skip("Empty prompt is valid for de novo — no sequence to validate")
    resp = client.post("/api/validate", json={"sequence": prefix})
    data = resp.get_json()
    assert resp.status_code == 200
    assert data["is_valid"] is True, f"{name}: {data.get('errors')}"


def test_validate_rejects_ambiguous_residues(client):
    resp = client.post("/api/validate", json={"sequence": "MBOXZACDEFGHIKLMNPQRSTVWY"})
    data = resp.get_json()
    assert resp.status_code == 200
    assert data["is_valid"] is False
    assert any("B" in e for e in data["errors"])


# ── Generate endpoint: request validation ──


def test_generate_rejects_invalid_model(client):
    resp = client.post("/api/generate", json={
        "prompt": "M",
        "model": "nonexistent-model",
        "num_sequences": 1,
        "max_length": 128,
    })
    assert resp.status_code == 400
    assert "not available" in resp.get_json()["error"]


def test_generate_rejects_excessive_sequences(client):
    resp = client.post("/api/generate", json={
        "prompt": "M",
        "num_sequences": 9999,
        "max_length": 128,
    })
    assert resp.status_code == 400
    assert "Maximum" in resp.get_json()["error"]


def test_generate_rejects_excessive_length(client):
    resp = client.post("/api/generate", json={
        "prompt": "M",
        "num_sequences": 1,
        "max_length": 9999,
    })
    assert resp.status_code == 400


def test_generate_rejects_noncanonical_prompt(client):
    resp = client.post("/api/generate", json={
        "prompt": "MBXO",
        "num_sequences": 1,
        "max_length": 128,
    })
    assert resp.status_code == 400
    assert "not valid amino acid" in resp.get_json()["error"]


# ── Generate endpoint: scoring mock tests ──


def _mock_scoring_response(sequences, model="170m-UR50-BRn"):
    """Build a mock Azure ML scoring response."""
    return {
        "sequences_with_fitness": [
            {"sequence": seq, "fitness_score": 55.0, "length": len(seq)}
            for seq in sequences
        ],
        "stats": {
            "total_generated": len(sequences),
            "valid_count": len(sequences),
            "invalid_count": 0,
            "success_rate": 100.0,
            "model": model,
            "generation_mode": "unconditional",
            "direction": "n_to_c",
        },
    }


@pytest.mark.parametrize("name,prefix", [
    (n, p) for n, p in GOLDEN_PREFIXES.items() if p  # skip de_novo (empty)
])
@patch("app.DAYHOFF_ENDPOINT", "https://mock-endpoint/score")
@patch("app.DAYHOFF_API_KEY", "mock-key")
@patch("app.http_requests.post")
def test_golden_prefix_preserves_seed_in_output(mock_post, client, name, prefix):
    """Generated sequences should start with the input prefix."""
    completed = prefix + "ACDEFGHIKLMNPQRSTVWY" * 3
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = _mock_scoring_response([completed])
    mock_post.return_value = mock_resp

    resp = client.post("/api/generate", json={
        "prompt": prefix,
        "model": "170m-UR50-BRn",
        "num_sequences": 1,
        "max_length": 512,
    })
    data = resp.get_json()
    assert resp.status_code == 200
    assert data["success"] is True
    for seq_entry in data["sequences_with_fitness"]:
        assert seq_entry["sequence"].startswith(prefix), (
            f"{name}: output does not preserve prefix"
        )


@patch("app.DAYHOFF_ENDPOINT", "https://mock-endpoint/score")
@patch("app.DAYHOFF_API_KEY", "mock-key")
@patch("app.http_requests.post")
def test_output_contains_only_canonical_residues(mock_post, client):
    """Backend must strip non-canonical characters from model output."""
    # Simulate model returning sequence with invalid characters
    dirty_seq = "MKLLVVVAGXLAVBALAAQAAGVNPDEVGGEALGRLLVVYPWTQRFFESFGDLSTPDAV"
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = _mock_scoring_response([dirty_seq])
    mock_post.return_value = mock_resp

    resp = client.post("/api/generate", json={
        "prompt": "M",
        "num_sequences": 1,
        "max_length": 512,
    })
    data = resp.get_json()
    assert data["success"] is True
    for entry in data["sequences_with_fitness"]:
        invalid = [c for c in entry["sequence"] if c not in CANONICAL_AMINO_ACIDS]
        assert invalid == [], f"Output contains non-canonical: {invalid}"


@patch("app.DAYHOFF_ENDPOINT", "https://mock-endpoint/score")
@patch("app.DAYHOFF_API_KEY", "mock-key")
@patch("app.http_requests.post")
def test_empty_generation_returns_error_not_success(mock_post, client):
    """A generation that produces no valid sequences must not return success=True."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = _mock_scoring_response([])
    mock_post.return_value = mock_resp

    resp = client.post("/api/generate", json={
        "prompt": "M",
        "num_sequences": 3,
        "max_length": 128,
    })
    data = resp.get_json()
    assert data["success"] is False
    assert "no valid" in data["error"].lower()


@patch("app.DAYHOFF_ENDPOINT", "https://mock-endpoint/score")
@patch("app.DAYHOFF_API_KEY", "mock-key")
@patch("app.http_requests.post")
def test_response_includes_correct_model_in_stats(mock_post, client):
    """Stats should report the model that was actually used."""
    seq = "MKLLVVVAGLAVALAAQAAGVNPDEVGGEALGRLLVVYPWTQRFFESFGDLSTPDAV"
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = _mock_scoring_response([seq], model="3b-UR90")
    mock_post.return_value = mock_resp

    resp = client.post("/api/generate", json={
        "prompt": "M",
        "model": "3b-UR90",
        "num_sequences": 1,
        "max_length": 256,
    })
    data = resp.get_json()
    assert data["stats"]["model"] == "3b-UR90"


@patch("app.DAYHOFF_ENDPOINT", "https://mock-endpoint/score")
@patch("app.DAYHOFF_API_KEY", "mock-key")
@patch("app.http_requests.post")
def test_scoring_timeout_returns_504(mock_post, client):
    """Scoring endpoint timeout should return a user-friendly 504."""
    import requests as http_requests
    mock_post.side_effect = http_requests.Timeout()

    resp = client.post("/api/generate", json={
        "prompt": "M",
        "num_sequences": 1,
        "max_length": 128,
    })
    assert resp.status_code == 504
    assert "try again" in resp.get_json()["error"].lower()


# ── Model listing ──


def test_models_endpoint_lists_all_variants(client):
    resp = client.get("/api/models")
    data = resp.get_json()
    assert resp.status_code == 200
    model_keys = {m["key"] for m in data["models"]}
    assert model_keys == set(AVAILABLE_MODELS.keys())
    for m in data["models"]:
        assert "params" in m
        assert "description" in m
        assert "supports_homologs" in m


# ── Export ──


def test_export_rejects_invalid_format(client):
    resp = client.post("/api/export/xlsx", json={
        "sequences": [],
        "parameters": {},
    })
    assert resp.status_code == 400
    assert "Supported" in resp.get_json()["error"]
