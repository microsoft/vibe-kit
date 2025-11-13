def test_help_command_lists_core_commands(run_cli, tmp_path):
    result = run_cli(tmp_path, "--help")
    assert result.returncode == 0, result.stderr
    out = result.stdout
    for cmd in ["init", "list", "install", "update", "uninstall"]:
        assert cmd in out
