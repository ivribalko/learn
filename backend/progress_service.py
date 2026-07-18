"""Course-repository-backed learner progress persistence."""

from __future__ import annotations

import json
import threading
from typing import Any

from backend.course_models import CourseDefinition
from backend.course_paths import course_progress_path


PROGRESS_LOCK = threading.Lock()


def get_course_progress(course: CourseDefinition) -> dict[str, Any]:
    """Returns normalized progress stored inside one course package."""

    with PROGRESS_LOCK:
        return _read_progress(course)


def complete_lesson(course: CourseDefinition, lesson_id: str) -> tuple[dict[str, Any], bool]:
    """Marks one lesson complete and reports whether progress changed."""

    course.lesson(lesson_id)
    with PROGRESS_LOCK:
        progress = _read_progress(course)
        completed_ids = set(progress["completedLessonIds"])
        if lesson_id in completed_ids:
            return progress, False
        completed_ids.add(lesson_id)
        progress = {
            "completedLessonIds": [
                lesson.lesson_id for lesson in course.lessons if lesson.lesson_id in completed_ids
            ],
        }
        _write_progress(course, progress)
        return progress, True


def restart_lesson(course: CourseDefinition, lesson_id: str) -> tuple[dict[str, Any], bool]:
    """Removes one completion marker and reports whether progress changed."""

    course.lesson(lesson_id)
    with PROGRESS_LOCK:
        progress = _read_progress(course)
        completed_ids = [item for item in progress["completedLessonIds"] if item != lesson_id]
        if completed_ids == progress["completedLessonIds"]:
            return progress, False
        progress = {"completedLessonIds": completed_ids}
        _write_progress(course, progress)
        return progress, True


def _read_progress(course: CourseDefinition) -> dict[str, Any]:
    default = {"completedLessonIds": []}
    path = course_progress_path(course)
    if not path.exists():
        return default
    try:
        value = json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return default
    if not isinstance(value, dict):
        return default

    valid_ids = {lesson.lesson_id for lesson in course.lessons}
    completed_value = value.get("completedLessonIds")
    completed_ids = (
        {item for item in completed_value if isinstance(item, str) and item in valid_ids}
        if isinstance(completed_value, list)
        else set()
    )
    return {
        "completedLessonIds": [
            lesson.lesson_id for lesson in course.lessons if lesson.lesson_id in completed_ids
        ],
    }


def _write_progress(course: CourseDefinition, progress: dict[str, Any]) -> None:
    path = course_progress_path(course)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_suffix(".tmp")
    temporary_path.write_text(json.dumps(progress, indent=2) + "\n")
    temporary_path.replace(path)
