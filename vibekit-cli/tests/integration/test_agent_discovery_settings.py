import json
import subprocess
from pathlib import Path


def _create_template_with_agents(base_dir: Path) -> Path:
    template_dir = base_dir / "template_with_agents"
    template_dir.mkdir(parents=True, exist_ok=True)

    (template_dir / ".vibe-kit" / "agents").mkdir(parents=True, exist_ok=True)
    (template_dir / ".vibe-kit" / "agents" / "test.agent.md").write_text(
        "---\nname: test\ndescription: test\n---\n",
        encoding="utf-8",
    )

    (template_dir / ".vscode").mkdir(parents=True, exist_ok=True)
    settings = {
        "chat.agentFilesLocations": {
            ".vibe-kit/agents": True,
        },
    }
    (template_dir / ".vscode" / "settings.json").write_text(
        json.dumps(settings, indent=4) + "\n",
        encoding="utf-8",
    )

    subprocess.run(["git", "init", "-q"], cwd=template_dir, check=True)
    subprocess.run(["git", "add", "."], cwd=template_dir, check=True)
    subprocess.run(["git", "commit", "-q", "-m", "init"], cwd=template_dir, check=True)
    return template_dir


def test_init_preserves_agent_discovery_settings_and_agents_dir(run_cli, tmp_path: Path):
    template_dir = _create_template_with_agents(tmp_path)

    result = run_cli(
        tmp_path,
        "init",
        env={"VIBEKIT_INIT_REPO_URL": str(template_dir)},
    )
    assert result.returncode == 0, result.stdout + result.stderr

    settings_file = tmp_path / ".vscode" / "settings.json"
    assert settings_file.exists()

    settings_data = json.loads(settings_file.read_text(encoding="utf-8"))
    assert "chat.agentFilesLocations" in settings_data
    assert settings_data["chat.agentFilesLocations"].get(".vibe-kit/agents") is True
    assert "chat.chatModesLocations" not in settings_data
    assert "chat.chatModeFilesLocations" not in settings_data

    assert (tmp_path / ".vibe-kit" / "agents" / "test.agent.md").exists()