from pathlib import Path

def test_init_uses_unspecified_when_no_override_or_env(run_cli, tmp_path: Path):
    result = run_cli(tmp_path, "init")
    assert result.returncode == 0, result.stderr
    readme = (tmp_path/".vibe-kit"/"README.md").read_text(encoding="utf-8")
    assert "source: unspecified" in readme
