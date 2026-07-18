"""Course-scoped runtime paths."""

from pathlib import Path

from backend.course_models import CourseDefinition, LessonDefinition


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def course_dir(course: CourseDefinition) -> Path:
    """Returns the versioned runtime root for one course."""

    return course.runtime_dir


def lessons_dir(course: CourseDefinition) -> Path:
    """Returns the editable lesson directory for one course."""

    return course_dir(course) / "lessons"


def course_progress_path(course: CourseDefinition) -> Path:
    """Returns the versioned learner-progress path for one course."""

    return course_dir(course) / "progress.json"


def lesson_path(course: CourseDefinition, lesson: LessonDefinition) -> Path:
    """Returns the editable source path for one lesson."""

    return lessons_dir(course) / lesson.file_name


def lesson_output_path(course: CourseDefinition, lesson: LessonDefinition) -> Path:
    """Returns the persisted run-result path for one lesson."""

    return lesson_path(course, lesson).with_suffix(".output.json")


def lesson_answers_path(course: CourseDefinition, lesson: LessonDefinition) -> Path:
    """Returns the persisted exam-answer path for one lesson."""

    return lesson_path(course, lesson).with_suffix(".answers.json")


def asset_path(course: CourseDefinition, lesson: LessonDefinition) -> Path:
    """Returns the generated asset path for one lesson."""

    return course_dir(course) / "cache" / lesson.asset.cache_dir / lesson.asset.file_name


def asset_metadata_path(course: CourseDefinition, lesson: LessonDefinition) -> Path:
    """Returns the generated asset metadata path for one lesson."""

    return asset_path(course, lesson).with_suffix(".metadata.json")
