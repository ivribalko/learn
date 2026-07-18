"""Course repository synchronization triggers."""

from __future__ import annotations

import os
from pathlib import Path
from uuid import uuid4


COURSES_SYNC_REQUEST_DIR = "COURSES_SYNC_REQUEST_DIR"


def request_course_sync() -> None:
    """Queues one repository synchronization when the service is configured."""

    configured_dir = os.environ.get(COURSES_SYNC_REQUEST_DIR)
    if not configured_dir:
        return
    request_dir = Path(configured_dir)
    request_dir.mkdir(parents=True, exist_ok=True)
    (request_dir / uuid4().hex).touch(exist_ok=False)
