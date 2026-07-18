"""Shared course, lesson, asset, glossary, and exam definitions."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Callable


@dataclass(frozen=True)
class GlossaryEntry:
    """Describes one course glossary entry and its recognized terms."""

    terms: tuple[str, ...]
    label: str
    definition: str
    external_url: str | None = None


@dataclass(frozen=True)
class LessonCheck:
    """Describes one output marker expected from a lesson run."""

    label: str
    required_text: str


@dataclass(frozen=True)
class SourceLessonDefinition:
    """Describes course-owned source code before public presentation is attached."""

    file_name: str
    template: str
    checks: tuple[LessonCheck, ...]
    execution_mode: str | None = None


@dataclass(frozen=True)
class LessonAssetDefinition:
    """Describes one generated lesson asset and its materializer."""

    file_name: str
    cache_dir: str
    materialize: Callable[[Path], tuple[int, int]]


@dataclass(frozen=True)
class CsvSourceAssetDefinition:
    """Describes a deterministic CSV asset owned by a course."""

    file_name: str
    materialize: Callable[[Path], tuple[int, int]]


@dataclass(frozen=True)
class TextSourceAssetDefinition:
    """Describes deterministic text content used as a lesson asset."""

    file_name: str
    content: str


@dataclass(frozen=True)
class ExamOption:
    """Describes one selectable exam answer."""

    option_id: str
    text: str


@dataclass(frozen=True)
class ExamQuestion:
    """Describes one evaluated multiple-choice exam question."""

    question_id: str
    prompt: str
    options: tuple[ExamOption, ...]
    correct_option_id: str


@dataclass(frozen=True)
class ExamDefinition:
    """Describes an ordered exam attached to one lesson."""

    questions: tuple[ExamQuestion, ...]


@dataclass(frozen=True)
class SourceExamDefinition:
    """Associates common exam questions with a source lesson identifier."""

    lesson_id: str
    questions: tuple[ExamQuestion, ...]


@dataclass(frozen=True)
class LessonDefinition:
    """Combines lesson presentation, editable source, execution, and checks."""

    lesson_id: str
    route: str
    title: str
    file_name: str
    runtime: str
    language: str
    concept: tuple[str, ...]
    math: tuple[str, ...]
    exercise: str
    checkpoints: tuple[str, ...]
    template: str
    checks: tuple[LessonCheck, ...]
    runner_id: str
    asset: LessonAssetDefinition
    exam: ExamDefinition | None = None


@dataclass(frozen=True)
class ChapterDefinition:
    """Describes one ordered course chapter."""

    chapter_id: str
    title: str
    lesson_ids: tuple[str, ...]


@dataclass(frozen=True)
class AssetPresentation:
    """Describes how a course's lesson assets appear in the shared frontend."""

    label: str
    short_label: str
    icon: str
    preview_kind: str


@dataclass(frozen=True)
class CourseDefinition:
    """Describes one complete course consumed by the shared application."""

    course_id: str
    title: str
    help_instructions: str
    runtime_dir: Path
    asset_presentation: AssetPresentation
    chapters: tuple[ChapterDefinition, ...]
    lessons: tuple[LessonDefinition, ...]
    glossary: tuple[GlossaryEntry, ...]

    def lesson(self, lesson_id: str) -> LessonDefinition:
        """Returns a lesson by ID or raises KeyError."""

        for lesson in self.lessons:
            if lesson.lesson_id == lesson_id:
                return lesson
        raise KeyError(lesson_id)
