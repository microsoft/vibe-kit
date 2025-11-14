from pathlib import Path


def test_uninstall_removes_customizations(run_cli, tmp_path: Path):
    # prepare kit with customizations
    repo = tmp_path / "innovation-kit-repository" / "u-kit"
    (repo / "customizations").mkdir(parents=True)
    (repo / "MANIFEST.yml").write_text("kit_info:\n  name: u-kit\n  version: 1.0.0\n")
    (repo / "customizations" / "a.prompt.md").write_text("Prompt A")
    (repo / "customizations" / "b.chatmode.md").write_text("Chat B")
    (repo / "customizations" / "c.instructions.md").write_text("Instr C")
    (tmp_path/".env").write_text("VIBEKIT_BASE_PATH=./innovation-kit-repository\n")
    run_cli(tmp_path, "init", check=True)
    run_cli(tmp_path, "install", "u-kit")

    state = tmp_path / ".vibe-kit"
    prompt_file = state / "prompts" / "a.prompt.md"
    chat_file = state / "chatmodes" / "b.chatmode.md"
    instructions_file = state / "instructions" / "c.instructions.md"
    assert prompt_file.exists()
    assert chat_file.exists()
    assert instructions_file.exists()

    result = run_cli(tmp_path, "uninstall", "u-kit")

    print(result.stdout)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "removed customization 3 assets" in result.stdout.lower()
    assert not prompt_file.exists()
    assert not chat_file.exists()
    assert not instructions_file.exists()
