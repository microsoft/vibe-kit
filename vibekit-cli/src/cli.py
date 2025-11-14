import typer

from commands.common import (  # noqa: F401 (re-exported helpers if needed)
    baseline_source,
    emit_repo_source,
    ensure_minimal_kit_yaml,
)
from commands.init_cmd import run_init
from commands.install_cmd import run_install
from commands.list_cmd import run_list
from commands.uninstall_cmd import run_uninstall
from commands.update_cmd import run_update

app = typer.Typer(
    help="Minimal Innovation Kit CLI: init, list, install, update (modular)",
    no_args_is_help=True,
    context_settings={"help_option_names": ["-h", "--help"]},
)


@app.command()
def init(
    project_dir: str | None = typer.Argument(
        None,
        help="Optional project folder name; if omitted, scaffold into current working directory.",
    ),
    verbose: bool = typer.Option(
        False,
        "-v",
        "--verbose",
        help="Emit detailed debug/status messages during initialization",
    ),
):
    """Scaffold a new project.

    If no project_dir is provided, files are placed in the current directory.
    """
    run_init(project_dir=project_dir, verbose=verbose)


@app.command("list")
def list_command(
    installed_mode: bool = typer.Option(
        False, "-i", "--installed", help="List installed kits instead of available"
    ),
    json_out: bool = typer.Option(
        False, "--json", help="Output JSON array (available by default, installed with -i)"
    ),
):
    """List all available innovation kits and their names."""
    run_list(installed_mode, json_out)


@app.command(no_args_is_help=True)
def install(kit_name: str = typer.Argument(..., help="Name of kit to install")):
    """Install an innovation kit by name."""
    run_install(kit_name)


@app.command(no_args_is_help=True)
def update(
    kit_name: str = typer.Argument(..., help="Name of kit to update"),
    dry_run: bool = typer.Option(
        False, "--dry-run", help="Show installed vs available version without modifying anything"
    ),
):
    """Update an installed innovation kit by name."""
    run_update(kit_name, dry_run)


@app.command(no_args_is_help=True)
def uninstall(
    kit_name: str = typer.Argument(..., help="Name of kit to uninstall", metavar="kit-name"),
):
    """Uninstall an installed innovation kit by name."""
    run_uninstall(kit_name)


def main():  # pragma: no cover
    app()


if __name__ == "__main__":  # pragma: no cover
    main()
