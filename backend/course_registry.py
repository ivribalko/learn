"""Loads course definitions from the optional private course checkout."""

from __future__ import annotations

from importlib import import_module
from pathlib import Path
from types import ModuleType

from backend.course_models import CourseDefinition


COURSES_PACKAGE_DIR = Path(__file__).resolve().parents[1] / "courses"


def _load_course_module() -> ModuleType | None:
    """Imports the checkout registry when a course repository is installed."""

    if not (COURSES_PACKAGE_DIR / "__init__.py").is_file() or not (COURSES_PACKAGE_DIR / "registry.py").is_file():
        return None
    try:
        return import_module("courses.registry")
    except ModuleNotFoundError as error:
        missing = error.name or "unknown dependency"
        raise RuntimeError(f"The installed course checkout is missing dependency: {missing}") from error


def _load_courses() -> dict[str, CourseDefinition]:
    """Validates and indexes the ordered course definitions from the checkout."""

    module = _load_course_module()
    if module is None:
        return {}
    exported = getattr(module, "COURSES", None)
    if not isinstance(exported, tuple):
        raise RuntimeError("courses.registry.COURSES must be a tuple of CourseDefinition values.")

    courses: dict[str, CourseDefinition] = {}
    for course in exported:
        if not isinstance(course, CourseDefinition):
            raise RuntimeError("courses.registry.COURSES contains a value that is not a CourseDefinition.")
        if course.course_id in courses:
            raise RuntimeError(f"Duplicate course identifier: {course.course_id}")
        courses[course.course_id] = course
    return courses


COURSES = _load_courses()


def get_course(course_id: str) -> CourseDefinition:
    """Returns a registered course or raises KeyError."""

    return COURSES[course_id]
