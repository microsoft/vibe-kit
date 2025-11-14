from pathlib import Path
import json


def test_uninstall_not_installed(run_cli, tmp_path: Path):
    (tmp_path/".env").write_text("VIBEKIT_BASE_PATH=./innovation-kit-repository\n")
    run_cli(tmp_path, "init", check=True)
    result = run_cli(tmp_path, "uninstall", "ghost")
    assert result.returncode == 1
    assert "not installed" in result.stdout.lower()


def test_uninstall_happy(run_cli, tmp_path: Path):
    # prepare kit
    kit_src = tmp_path/"innovation-kit-repository"/"demo-u"; kit_src.mkdir(parents=True)
    (kit_src/"MANIFEST.yml").write_text("kit_info:\n  name: demo-u\n  version: 0.0.1\n")
    (tmp_path/".env").write_text("VIBEKIT_BASE_PATH=./innovation-kit-repository\n")
    run_cli(tmp_path, "init", check=True)
    run_cli(tmp_path, "install", "demo-u")
    kit_dir = tmp_path/".vibe-kit"/"innovation-kits"/"demo-u"
    assert kit_dir.exists()
    result = run_cli(tmp_path, "uninstall", "demo-u")
    assert result.returncode == 0
    assert "Uninstalled demo-u" in result.stdout
    assert not kit_dir.exists()
    # metadata removed
    meta_file = tmp_path/".vibe-kit"/"innovation-kits.json"
    data = json.loads(meta_file.read_text(encoding="utf-8"))
    assert all(k.get("id") != "demo-u" for k in data)


def test_uninstall_drift(run_cli, tmp_path: Path):
    # install then manually remove directory, then uninstall
    kit_src = tmp_path/"innovation-kit-repository"/"demo-drift"; kit_src.mkdir(parents=True)
    (kit_src/"MANIFEST.yml").write_text("kit_info:\n  name: demo-drift\n  version: 0.0.1\n")
    (tmp_path/".env").write_text("VIBEKIT_BASE_PATH=./innovation-kit-repository\n")
    run_cli(tmp_path, "init", check=True)
    run_cli(tmp_path, "install", "demo-drift")
    kit_dir = tmp_path/".vibe-kit"/"innovation-kits"/"demo-drift"
    assert kit_dir.exists()
    # simulate drift
    import shutil
    shutil.rmtree(kit_dir)
    result = run_cli(tmp_path, "uninstall", "demo-drift")
    assert result.returncode == 0

    assert "directory missing" in result.stdout.lower()
    assert "cleaning metadata" in result.stdout.lower()
