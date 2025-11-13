from pathlib import Path
import json

def test_install_happy(run_cli, tmp_path: Path):
    # create a local innovation-kit-repository with a simple kit
    kit_root = tmp_path / "innovation-kit-repository" / "test-kit"
    kit_root.mkdir(parents=True)
    (kit_root / "MANIFEST.yml").write_text("kit_info:\n  name: test-kit\n  version: 0.0.1\n  description: test kit\n")
    (tmp_path/".env").write_text("VIBEKIT_BASE_PATH=./innovation-kit-repository\n")
    run_cli(tmp_path, "init", check=True)
    result = run_cli(tmp_path, "install", "test-kit")
    assert result.returncode == 0, result.stderr
    kit_dir = tmp_path / ".vibe-kit" / "innovation-kits" / "test-kit"
    assert kit_dir.exists()
    assert (kit_dir / "kit.yaml").exists()
    # metadata contains kit
    meta = json.loads((tmp_path/".vibe-kit"/"innovation-kits.json").read_text(encoding="utf-8"))
    assert any(k["id"] == "test-kit" and k["version"] == "0.0.1" for k in meta)
