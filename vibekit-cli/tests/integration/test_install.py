from pathlib import Path
import json


def _create_dummy_repo_with_kit(tmp_path: Path, kit_name: str, manifest_content: str) -> Path:
    repo_root = tmp_path / "innovation-kit-repository"
    kit_root = repo_root / kit_name
    kit_root.mkdir(parents=True)
    (kit_root / "MANIFEST.yml").write_text(manifest_content, encoding="utf-8")

    (tmp_path/".env").write_text(f"VIBEKIT_BASE_PATH={repo_root}\n")

    return repo_root

def test_install_happy(run_cli, tmp_path: Path):
    # create a local innovation-kit-repository with a simple kit
    repo_root = _create_dummy_repo_with_kit(
        tmp_path, "test-kit", "kit_info:\n  name: test-kit\n  version: 0.0.1\n  description: test kit\n"
    )

    run_cli(tmp_path, "init", check=True)
    result = run_cli(tmp_path, "install", "test-kit")
    assert result.returncode == 0, result.stderr

    kit_dir = tmp_path / ".vibe-kit" / "innovation-kits" / "test-kit"
    assert kit_dir.exists()
    assert (kit_dir / "kit.yaml").exists()

    # metadata contains kit
    meta = json.loads((tmp_path/".vibe-kit"/"innovation-kits.json").read_text(encoding="utf-8"))
    assert any(k["id"] == "test-kit" and k["version"] == "0.0.1" for k in meta)


def test_install_with_post_instructions(run_cli, tmp_path: Path):
    # create a local innovation-kit-repository with a simple kit
    repo_root = _create_dummy_repo_with_kit(
        tmp_path,
        "test-kit",
        (
            "kit_info:\n"
            "  name: test-kit\n"
            "  version: 0.0.1\n"
            "  description: test kit\n"
            "post_install:\n"
            "  instructions_markdown: |\n"
            "    # Post Install Instructions\n"
            "    Please follow these steps...\n"
        ),
    )

    run_cli(tmp_path, "init", check=True)
    result = run_cli(tmp_path, "install", "test-kit")
    assert result.returncode == 0, result.stderr

    assert "Post Install Instructions" in result.stdout
    assert "Please follow these steps..." in result.stdout
