"""Preparation for course-owned runtime directories."""

from __future__ import annotations

import os
import pwd
from pathlib import Path

from backend.course_registry import COURSES, COURSES_PACKAGE_DIR


APPLICATION_USER = "learn"


def prepare_course_state() -> None:
    """Creates registered runtime directories with application ownership."""

    courses_root = COURSES_PACKAGE_DIR.resolve()
    account = pwd.getpwnam(APPLICATION_USER)
    for course in COURSES.values():
        runtime_dir = _contained_runtime_dir(course.runtime_dir, courses_root)
        runtime_dir.mkdir(parents=True, exist_ok=True)
        _set_tree_ownership(runtime_dir, account.pw_uid, account.pw_gid)


def _contained_runtime_dir(runtime_dir: Path, courses_root: Path) -> Path:
    """Returns a resolved runtime directory contained by the course checkout."""

    resolved = runtime_dir.resolve()
    try:
        resolved.relative_to(courses_root)
    except ValueError as error:
        raise RuntimeError(f"Course runtime directory is outside the checkout: {runtime_dir}") from error
    return resolved


def _set_tree_ownership(path: Path, uid: int, gid: int) -> None:
    """Assigns ownership without following links outside runtime state."""

    os.chown(path, uid, gid, follow_symlinks=False)
    for root, directories, files in os.walk(path, followlinks=False):
        for name in (*directories, *files):
            os.chown(Path(root) / name, uid, gid, follow_symlinks=False)


if __name__ == "__main__":
    prepare_course_state()
