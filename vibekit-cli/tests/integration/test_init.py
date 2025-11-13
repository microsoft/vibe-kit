from pathlib import Path

def test_init_creates_baseline(run_cli, tmp_path: Path):
    result = run_cli(tmp_path, "init")
    assert result.returncode == 0, result.stderr
    baseline = tmp_path / ".vibe-kit"
    assert baseline.exists()
    # Registry file removed in new design; ensure README present instead
    assert (baseline / "README.md").exists()
    # second run idempotent
    result2 = run_cli(tmp_path, "init")
    assert result2.returncode == 0
    assert "Baseline" in result2.stdout
