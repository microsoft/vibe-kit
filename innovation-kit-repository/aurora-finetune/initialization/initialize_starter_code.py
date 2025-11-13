#!/usr/bin/env python3
"""Initialize the Aurora finetuning starter code in the user's environment."""

import argparse
import shutil
import subprocess
from pathlib import Path


def find_git_root() -> Path:
    """
    Find the git repository root directory.

    Returns:
        Path to the git repository root

    Raises:
        ValueError: If not in a git repository
    """
    result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise ValueError("Not in a git repository. Cannot determine PROJECTROOT.")
    return Path(result.stdout.strip())


def get_designated_paths() -> dict[str, Path]:
    """
    Determine source, target, and project root paths.

    Returns:
        Dictionary with keys: 'starter_code_dir', 'target_dir', 'project_root'

    Raises:
        ValueError: If starter-code directory not found
    """
    script_dir = Path(__file__).parent
    starter_code_dir = (script_dir / "../starter-code").resolve()

    if not starter_code_dir.is_dir():
        raise ValueError(f"starter-code directory not found at {starter_code_dir}")

    project_root = find_git_root()
    target_dir = project_root / "aurora-finetune"

    return {
        "starter_code_dir": starter_code_dir,
        "target_dir": target_dir,
        "project_root": project_root,
    }


def check_target_does_not_exist(target_dir: Path) -> None:
    """
    Verify target directory doesn't exist to prevent overwriting.

    Args:
        target_dir: Directory path to check

    Raises:
        ValueError: If target directory already exists
    """
    if target_dir.exists():
        raise ValueError(
            f"Target directory already exists at {target_dir}\n"
            f"You may have already finished the initialization process. \n"
            f"If you'd still like to perform the initialization, Please remove the "
            f"existing directory first:\n"
            f"  rm -rf {target_dir}"
        )


def copy_starter_code(source_dir: Path, target_dir: Path) -> None:
    """
    Copy starter code from source to target directory.

    Args:
        source_dir: Source directory containing starter code
        target_dir: Destination directory for copied files
    """
    print("Copying starter code contents...")
    shutil.copytree(source_dir, target_dir)
    print("✓ Starter code copied successfully")
    print()


def install_dependencies(target_dir: Path) -> None:
    """
    Install dependencies using uv sync.

    Args:
        target_dir: Directory containing the project to install dependencies for
    """
    print("Installing dependencies with uv sync...")
    subprocess.run(["uv", "sync"], cwd=target_dir, check=True)
    print("✓ Dependencies installed successfully")
    print()


def run_tests(target_dir: Path) -> None:
    """
    Run pytest to verify installation.

    Args:
        target_dir: Directory containing the tests to run
    """
    print("Running tests to verify installation...")
    subprocess.run(["uv", "run", "pytest", "-s"], cwd=target_dir, check=True)
    print("✓ Tests completed successfully")
    print()


def print_banner(project_root: Path, source_dir: Path, target_dir: Path) -> None:
    """
    Print initialization banner with paths.

    Args:
        project_root: Git repository root path
        source_dir: Source directory path
        target_dir: Target directory path
    """
    print("=== Aurora Finetuning Starter Code Initialization ===")
    print(f"Project root: {project_root}")
    print(f"Source directory: {source_dir}")
    print(f"Target directory: {target_dir}")
    print()


def main() -> None:
    """Main entry point for initialization script."""
    # Parse command-line arguments
    parser = argparse.ArgumentParser(
        description="Initialize Aurora finetuning starter code in your environment"
    )
    parser.add_argument(
        "--skip-tests",
        action="store_true",
        help="Skip running pytest after installation",
    )
    args = parser.parse_args()

    # Get paths
    paths = get_designated_paths()
    starter_code_dir = paths["starter_code_dir"]
    target_dir = paths["target_dir"]
    project_root = paths["project_root"]

    # Print banner
    print_banner(project_root, starter_code_dir, target_dir)

    # Check target doesn't exist
    check_target_does_not_exist(target_dir)

    # Copy files
    copy_starter_code(starter_code_dir, target_dir)

    # Install dependencies
    install_dependencies(target_dir)

    # Optionally run tests
    if not args.skip_tests:
        run_tests(target_dir)
    else:
        print("⊗ Skipping tests (--skip-tests flag was set)")
        print()

    # Success message
    print("=== Initialization Complete ===")
    print(f"Aurora finetuning starter code is ready at: {target_dir}")


if __name__ == "__main__":
    main()
