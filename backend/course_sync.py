"""Course repository synchronization triggers."""

from __future__ import annotations

import os
from pathlib import Path
from uuid import uuid4


COURSES_SYNC_REQUEST_DIR = "COURSES_SYNC_REQUEST_DIR"


def request_course_sync(course_id: str, lesson_id: str) -> None:
    """Queues one course-and-lesson repository synchronization request."""

    configured_dir = os.environ.get(COURSES_SYNC_REQUEST_DIR)
    if not configured_dir:
        return
    if "\n" in course_id or "\n" in lesson_id:
        raise ValueError("Course and lesson identifiers must not contain newlines.")
    request_dir = Path(configured_dir)
    request_dir.mkdir(parents=True, exist_ok=True)
    request_id = uuid4().hex
    temporary_path = request_dir / f".{request_id}.tmp"
    temporary_path.write_text(f"{course_id}\n{lesson_id}\n")
    temporary_path.replace(request_dir / request_id)
