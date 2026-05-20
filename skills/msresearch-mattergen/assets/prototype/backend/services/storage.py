from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from models.api import (
    GenerationJob,
    GenerationRequest,
    GenerationJobWithStructures,
    StructureSummary,
)


@dataclass
class JobPaths:
    root: Path
    raw_dir: Path
    processed_dir: Path
    structures_dir: Path
    job_metadata_path: Path


def job_paths(results_root: Path, job_id: str) -> JobPaths:
    root = results_root / "jobs" / job_id
    raw_dir = root / "raw"
    processed_dir = root / "processed"
    structures_dir = processed_dir / "structures"
    job_metadata_path = root / "job.json"
    return JobPaths(root, raw_dir, processed_dir, structures_dir, job_metadata_path)


def init_job_storage(
    results_root: Path, job_id: str, request: GenerationRequest
) -> GenerationJob:
    paths = job_paths(results_root, job_id)
    paths.raw_dir.mkdir(parents=True, exist_ok=True)
    paths.structures_dir.mkdir(parents=True, exist_ok=True)

    job = GenerationJob(
        id=job_id,
        status="queued",
        created_at=datetime.now(timezone.utc),
        request=request,
        artifact_uri=None,
    )
    save_job(paths, job)
    return job


def save_job(paths: JobPaths, job: GenerationJob) -> None:
    paths.root.mkdir(parents=True, exist_ok=True)
    paths.job_metadata_path.write_text(job.model_dump_json(indent=2))


def load_job(paths: JobPaths) -> GenerationJob:
    data = paths.job_metadata_path.read_text()
    return GenerationJob.model_validate_json(data)


def save_structures(paths: JobPaths, structures: Iterable[StructureSummary]) -> None:
    for s in structures:
        path = paths.structures_dir / f"{s.id}.json"
        path.write_text(s.model_dump_json(indent=2))


def load_structures(paths: JobPaths) -> list[StructureSummary]:
    if not paths.structures_dir.exists():
        return []
    result: list[StructureSummary] = []
    for path in sorted(paths.structures_dir.glob("*.json")):
        data = path.read_text()
        result.append(StructureSummary.model_validate_json(data))
    return result


def get_job_with_structures(
    results_root: Path, job_id: str
) -> GenerationJobWithStructures:
    paths = job_paths(results_root, job_id)
    job = load_job(paths)
    structures = load_structures(paths)
    return GenerationJobWithStructures(job=job, structures=structures)
