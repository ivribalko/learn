"""Generic lesson-asset materialization and metadata handling."""

from __future__ import annotations

import csv
import json
from pathlib import Path

from backend.course_models import CourseDefinition, LessonDefinition
from backend.course_paths import asset_metadata_path, asset_path


def write_csv(path: Path, headers: list[str], rows: list[list[object]]) -> tuple[int, int]:
    """Writes deterministic tabular asset rows and returns their dimensions."""

    with path.open("w", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(headers)
        writer.writerows(rows)
    return len(rows), len(headers)


def asset_exists(course: CourseDefinition, lesson: LessonDefinition) -> bool:
    """Reports whether a lesson asset exists."""

    return asset_path(course, lesson).exists()


def materialize_asset(course: CourseDefinition, lesson: LessonDefinition) -> tuple[Path, int, int]:
    """Creates a lesson asset and stores normalized metadata."""

    path = asset_path(course, lesson)
    path.parent.mkdir(parents=True, exist_ok=True)
    rows, columns = lesson.asset.materialize(path)
    asset_metadata_path(course, lesson).write_text(
        json.dumps(
            {
                "rows": rows,
                "columns": columns,
            },
            indent=2,
        )
    )
    return path, rows, columns


def read_asset_metadata(course: CourseDefinition, lesson: LessonDefinition) -> dict[str, object]:
    """Reads generated lesson-asset metadata when present."""

    path = asset_metadata_path(course, lesson)
    if not path.exists():
        return {}
    try:
        value = json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return {}
    return value if isinstance(value, dict) else {}


def reset_asset(course: CourseDefinition, lesson: LessonDefinition) -> None:
    """Deletes a generated asset and its metadata."""

    for path in (asset_path(course, lesson), asset_metadata_path(course, lesson)):
        if path.exists():
            path.unlink()
