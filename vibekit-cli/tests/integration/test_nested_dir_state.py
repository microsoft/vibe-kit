from pathlib import Path
import json

def test_nested_invocation_uses_root_state(run_cli, tmp_path: Path):
    # Arrange: create repo with one kit and initialize at root
    repo = tmp_path / "innovation-kit-repository" / "test-kit"
    repo.mkdir(parents=True)
    (repo / "MANIFEST.yml").write_text("kit_info:\n  name: test-kit\n  version: 0.0.2\n  description: test kit nested\n")
    (tmp_path/".env").write_text("VIBEKIT_BASE_PATH=./innovation-kit-repository\n")
    run_cli(tmp_path, "init", check=True)
    root_state = tmp_path / ".vibe-kit"
    assert root_state.is_dir()

    # Act: run install from a nested directory (simulate user inside subfolder)
    nested = tmp_path / "some" / "deep" / "folder"
    nested.mkdir(parents=True)
    result = run_cli(nested, "install", "test-kit")
    assert result.returncode == 0, result.stderr

    # Assert: kit installed into root state, not nested path chain
    kit_dir = root_state / "innovation-kits" / "test-kit"
    assert kit_dir.exists()
    assert not (nested / ".vibe-kit").exists(), "Should not create nested .vibe-kit directory"
    meta = json.loads((root_state/"innovation-kits.json").read_text(encoding="utf-8"))
    assert any(k["id"] == "test-kit" and k["version"] == "0.0.2" for k in meta)
