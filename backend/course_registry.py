"""Loads course definitions and execution runners from the optional checkout."""

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


def _load_courses(module: ModuleType | None) -> dict[str, CourseDefinition]:
    """Validates and indexes the ordered course definitions from the checkout."""

    if module is None:
        return {}
    exported = getattr(module, "COURSES", None)
    if not isinstance(exported, tuple):
        raise RuntimeError("courses.registry.COURSES must be a tuple of CourseDefinition values.")

    courses: dict[str, CourseDefinition] = {}
    for course in exported:
        if not isinstance(course, CourseDefinition):
            raise RuntimeError("courses.registry.COURSES contains a value that is not a CourseDefinition.")
        if not isinstance(course.runtime_dir, Path):
            raise RuntimeError(f"Course runtime directory is not a path: {course.course_id}")
        try:
            course.runtime_dir.resolve().relative_to(COURSES_PACKAGE_DIR.resolve())
        except ValueError as error:
            raise RuntimeError(f"Course runtime directory is outside the checkout: {course.course_id}") from error
        if course.course_id in courses:
            raise RuntimeError(f"Duplicate course identifier: {course.course_id}")
        courses[course.course_id] = course
    return courses


def _load_runners(module: ModuleType | None, courses: dict[str, CourseDefinition]) -> dict[str, object]:
    """Validates the checkout-owned runner registry and lesson references."""

    if module is None:
        return {}
    exported = getattr(module, "RUNNERS", None)
    if not isinstance(exported, dict):
        raise RuntimeError("courses.registry.RUNNERS must be a dictionary of lesson runners.")

    runners: dict[str, object] = {}
    for runner_id, runner in exported.items():
        if not isinstance(runner_id, str) or not all(
            callable(getattr(runner, method, None)) for method in ("run", "reset", "health")
        ):
            raise RuntimeError("courses.registry.RUNNERS contains an invalid lesson runner.")
        runners[runner_id] = runner

    for course in courses.values():
        for lesson in course.lessons:
            if lesson.runner_id not in runners:
                raise RuntimeError(f"Unknown runner identifier for {course.course_id}/{lesson.lesson_id}: {lesson.runner_id}")
    return runners


COURSES_MODULE = _load_course_module()
COURSES = _load_courses(COURSES_MODULE)
RUNNERS = _load_runners(COURSES_MODULE, COURSES)


def get_course(course_id: str) -> CourseDefinition:
    """Returns a registered course or raises KeyError."""

    return COURSES[course_id]


def get_runner(runner_id: str) -> object:
    """Returns a checkout-owned lesson runner or raises KeyError."""

    return RUNNERS[runner_id]


def runner_health() -> dict[str, str]:
    """Returns merged capability state from all checkout-owned runners."""

    health: dict[str, str] = {}
    for runner in RUNNERS.values():
        health.update(runner.health())  # type: ignore[attr-defined]
    return health
