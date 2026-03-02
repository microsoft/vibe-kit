from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Sequence

from rich.console import Console
from rich.table import Table

from state import load_installed_kits, resolve_state_root
from commands.common import emit_repo_source
from repositories import KitSummary, RepositoryContext, detect_repositories
from constants import REMOTE_SOURCE

console = Console()


def _context_label(context: RepositoryContext) -> str:
    if context.kind == "github":
        return context.remote_url or "remote repository"
    if context.kind == "local" and context.roots:
        return ", ".join(str(root) for root in context.roots)
    return context.kind


def _collect_entries(
    contexts: Sequence[RepositoryContext],
) -> tuple[List[Dict[str, str]], Exception | None]:
    aggregated: List[Dict[str, str]] = []
    for context in contexts:
        repository = context.repository
        try:
            summaries = repository.list_kits()
        except (ValueError, RuntimeError) as exc:
            return [], exc

        aggregated.extend(_summaries_to_entries(summaries))

    aggregated.sort(key=lambda item: item.get("id", ""))
    return aggregated, None


def _emit_json_for_contexts(contexts: Sequence[RepositoryContext]) -> None:
    entries, error = _collect_entries(contexts)
    if error is not None:
        print("[]")
        return
    print(json.dumps(entries, ensure_ascii=False, indent=2))


def _emit_tables_for_contexts(contexts: Sequence[RepositoryContext]) -> None:
    for context in contexts:
        repository = context.repository
        if context.kind == "local":
            emit_repo_source(list(context.roots), getattr(repository, "source_kind", None))
        elif context.kind == "github":
            console.print(f"[dim]Repository source: {REMOTE_SOURCE} -> {context.remote_url}[/]")

    entries, error = _collect_entries(contexts)
    if error is not None:
        console.print(f"[red]{error}[/]")
        return

    if entries:
        _emit_entries(entries, False, "Available Innovation Kits (combined)")
    else:
        console.print("[yellow]No available kits found[/]")


def run_list(installed_mode: bool, json_out: bool) -> None:
    root = resolve_state_root(Path.cwd())
    # 1) Installed kits stored in local state
    if installed_mode:
        _emit_installed_kits(root, json_out)
        return

    contexts = detect_repositories(root)
    if not contexts:
        if json_out:
            print("[]")
        else:
            console.print("[yellow]No local innovation-kit-repository found[/]")
        return

    if json_out:
        _emit_json_for_contexts(contexts)
        return

    _emit_tables_for_contexts(contexts)


def _emit_installed_kits(root: Path, json_out: bool) -> None:
    installed = load_installed_kits(root)
    if json_out:
        print(json.dumps(installed, ensure_ascii=False, indent=2))
        return
    if not installed:
        console.print(f"[yellow]No kits installed under: {root}[/]")
        return

    entries = _installed_to_entries(installed, root)
    _emit_entries(entries, False, f"Installed Innovation Kits under: {root}")


def _summaries_to_entries(summaries: Sequence[KitSummary]) -> List[Dict[str, str]]:
    entries: List[Dict[str, str]] = []
    for summary in summaries:
        entries.append(
            {
                "id": summary.identifier,
                "version": summary.version or "0.0.0",
                "path": summary.source_hint or "",
                "legacy_descriptor": "true" if summary.legacy_descriptor else "false",
            }
        )
    entries.sort(key=lambda entry: entry.get("id", ""))
    return entries


def _emit_entries(entries: List[Dict[str, str]], json_out: bool, title: str) -> None:
    if json_out:
        print(json.dumps(entries, ensure_ascii=False, indent=2))
        return
    if not entries:
        console.print("[yellow]No available kits found[/]")
        return

    table = Table(title=title, header_style="bold cyan", title_justify="left")
    table.add_column("Kit Name", style="bold", justify="left")
    table.add_column("Version", justify="left")
    table.add_column("Location", overflow="fold", justify="left")

    for entry in entries:
        table.add_row(
            entry.get("id", ""),
            entry.get("version", ""),
            entry.get("path", ""),
        )
    console.print(table)

    legacy_entries = [entry for entry in entries if entry.get("legacy_descriptor") == "true"]
    for legacy_entry in legacy_entries:
        console.print(
            "[yellow]Deprecation:[/] "
            f"Kit '[bold]{legacy_entry.get('id', '')}[/]' uses legacy INNOVATION_KIT.md metadata. "
            "Prefer SKILL.md."
        )


def _installed_to_entries(installed: Sequence[Dict[str, str]], root: Path) -> List[Dict[str, str]]:
    entries: List[Dict[str, str]] = []
    for kit in installed:
        raw_path = kit.get("path", "")
        display_path = raw_path
        if raw_path:
            candidate = Path(raw_path)
            if not candidate.is_absolute():
                # Normalize to absolute path so the installed table matches repository listings.
                display_path = str((root / candidate).resolve())
            else:
                display_path = str(candidate)
        entries.append(
            {
                "id": kit.get("id", ""),
                "version": kit.get("version", ""),
                "path": display_path,
            }
        )
    entries.sort(key=lambda entry: entry.get("id", ""))
    return entries


def _build_title(context: RepositoryContext) -> str:
    if context.kind == "github":
        display = context.remote_url or "remote repository"
        return f"Available Innovation Kits: {display} [ENV]"

    if context.kind == "local":
        roots_str = ", ".join(str(root) for root in context.roots)
        source = getattr(context.repository, "source_kind", None) or "local"
        return f"Available Innovation Kits: {roots_str} [{source}]"

    return "Available Innovation Kits"
