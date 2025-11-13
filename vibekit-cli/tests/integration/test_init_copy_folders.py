from pathlib import Path

FOLDERS = [".devcontainer", ".github", "frontend", "backend"]

def test_init_does_not_fail_without_optional_folders(run_cli, tmp_path: Path):
    result = run_cli(tmp_path, "init")
    assert result.returncode == 0, result.stderr
    # baseline state dir created
    assert (tmp_path / ".vibe-kit").exists()


def test_init_with_existing_optional_folders(run_cli, tmp_path: Path):
    # create each folder with a marker file
    for f in FOLDERS:
        d = tmp_path / f
        d.mkdir(parents=True, exist_ok=True)
        (d / "marker.txt").write_text(f"{f} marker", encoding="utf-8")
    result = run_cli(tmp_path, "init")
    assert result.returncode == 0, result.stderr
    # ensure folders still exist and marker preserved
    for f in FOLDERS:
        marker = tmp_path / f / "marker.txt"
        assert marker.exists(), f"Missing marker in {f}"


def test_init_idempotent_second_run(run_cli, tmp_path: Path):
    # prepare one folder
    d = tmp_path / FOLDERS[0]
    d.mkdir(parents=True, exist_ok=True)
    (d / "marker.txt").write_text("keep", encoding="utf-8")
    first = run_cli(tmp_path, "init")
    assert first.returncode == 0
    second = run_cli(tmp_path, "init")
    assert second.returncode == 0
    # marker still there
    assert (d / "marker.txt").read_text(encoding="utf-8") == "keep"
