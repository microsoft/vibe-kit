from pathlib import Path


def test_install_customizations_extracted(run_cli, tmp_path: Path):
    (tmp_path/".env").write_text("VIBEKIT_BASE_PATH=./innovation-kit-repository\n")
    run_cli(tmp_path, "init", check=True)
    repo = tmp_path / "innovation-kit-repository" / "asset-kit"
    (repo / "customizations" / "nested").mkdir(parents=True)
    repo.mkdir(parents=True, exist_ok=True)
    (repo / "MANIFEST.yml").write_text("kit_info:\n  name: asset-kit\n  version: 1.0.0\n")
    # Assets only inside customizations/
    (repo / "customizations" / "a.chatmode.md").write_text("Chatmode A")
    (repo / "customizations" / "nested" / "b.prompt.md").write_text("Prompt B")
    (repo / "customizations" / "c.instructions.md").write_text("Instruction C")

    result = run_cli(tmp_path, "install", "asset-kit")
    assert result.returncode == 0, result.stdout + result.stderr

    state_dir = tmp_path / ".vibe-kit"
    # Individual files expected (names preserved)
    chat_file = state_dir / "chatmodes" / "a.chatmode.md"
    prompt_file = state_dir / "prompts" / "b.prompt.md"
    instructions_file = state_dir / "instructions" / "c.instructions.md"
    assert chat_file.exists()
    assert prompt_file.exists()
    assert instructions_file.exists()
    # customizations directory should be absent from installed kit copy
    installed_custom_dir = state_dir / "innovation-kits" / "asset-kit" / "customizations"
    assert not installed_custom_dir.exists()

    # Reinstall should not alter aggregated file count
    result2 = run_cli(tmp_path, "install", "asset-kit")
    assert result2.returncode == 0
    # Files still single each
    assert len(list((state_dir / "chatmodes").glob("a.chatmode.md"))) == 1
    assert len(list((state_dir / "prompts").glob("b.prompt.md"))) == 1
