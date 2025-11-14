from pathlib import Path
import json


def test_list_available_no_repo(run_cli, tmp_path: Path):
    # No innovation-kit-repository yet
    run_cli(tmp_path, "init")
    res = run_cli(tmp_path, "list")
    assert res.returncode == 0
    assert "No local innovation-kit-repository found" in res.stdout


def test_list_available_and_installed(run_cli, tmp_path: Path):
    (tmp_path/".env").write_text("VIBEKIT_BASE_PATH=./innovation-kit-repository\n")
    run_cli(tmp_path, "init")

    # create two available kits
    kit_a = tmp_path/"innovation-kit-repository"/"kit-a"; kit_a.mkdir(parents=True)
    (kit_a/"MANIFEST.yml").write_text("kit_info:\n  name: kit-a\n  version: 0.1.0\n")
    kit_b = tmp_path/"innovation-kit-repository"/"kit-b"; kit_b.mkdir(parents=True)
    # kit-b without manifest -> version 0.0.0 default

    res_avail = run_cli(tmp_path, "list")
    assert " kit-a  │ 0.1.0   │ " in res_avail.stdout
    assert " kit-b  │ 0.0.0   │ " in res_avail.stdout

    # install kit-a
    run_cli(tmp_path, "install", "kit-a")
    res_inst = run_cli(tmp_path, "list", "-i")
    assert " kit-a  │ 0.1.0   │ " in res_inst.stdout

    # installed JSON
    res_inst_json = run_cli(tmp_path, "list", "-i", "--json")
    data = json.loads(res_inst_json.stdout)
    assert any(k.get("id") == "kit-a" for k in data)

    # available JSON
    res_avail_json = run_cli(tmp_path, "list", "--json")
    # First line may be repository source provenance; JSON begins on subsequent line.
    print(res_avail_json.stdout)
    avail = json.loads(res_avail_json.stdout)
    a_entry = next(e for e in avail if e["id"] == "kit-a")
    assert a_entry["version"] == "0.1.0"


def test_list_installed_none(run_cli, tmp_path: Path):
    (tmp_path/".env").write_text("VIBEKIT_BASE_PATH=./innovation-kit-repository\n")
    run_cli(tmp_path, "init")
    res = run_cli(tmp_path, "list", "-i")
    assert "No kits installed" in res.stdout
