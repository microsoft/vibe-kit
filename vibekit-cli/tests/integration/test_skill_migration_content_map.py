import json
import pathlib


REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
MAPPING_FILE = REPO_ROOT / "docs" / "plans" / "skill-migration-content-map.json"


def test_skill_migration_content_map_destinations_exist() -> None:
    mapping_payload = json.loads(MAPPING_FILE.read_text(encoding="utf-8"))
    mappings = mapping_payload.get("mappings", [])
    assert mappings, "Expected at least one migration mapping entry"

    missing_destinations: list[str] = []
    for mapping in mappings:
        source_path = REPO_ROOT / mapping["source"]
        destination_paths = [
            REPO_ROOT / destination
            for destination in mapping.get("destinations", [])
        ]

        for destination_path in destination_paths:
            if not destination_path.exists():
                missing_destinations.append(str(destination_path.relative_to(REPO_ROOT)))

        if not source_path.exists():
            assert destination_paths, (
                f"Missing destination mapping for deleted source {mapping['source']}"
            )
            assert all(destination_path.exists() for destination_path in destination_paths), (
                f"Deleted source {mapping['source']} has missing mapped destination"
            )

    assert not missing_destinations, f"Missing mapped destinations: {missing_destinations}"
