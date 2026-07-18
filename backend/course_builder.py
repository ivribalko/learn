"""Adapters that combine course presentation JSON with executable source data."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable

from backend.course_models import (
    AssetPresentation,
    ChapterDefinition,
    CourseDefinition,
    ExamDefinition,
    ExamOption,
    ExamQuestion,
    GlossaryEntry,
    LessonAssetDefinition,
    LessonCheck,
    LessonDefinition,
)


def build_course(
    *,
    course_id: str,
    title: str,
    help_instructions: str,
    presentation_path: Path,
    source_lessons: dict[str, Any],
    source_assets: dict[str, Any],
    source_exams: dict[str, Any],
    runner_id: str,
    language: str,
    default_runtime: str,
    asset_presentation: AssetPresentation,
    cache_dir: str,
    asset_materializer: Callable[[Any, Path], tuple[int, int]],
) -> CourseDefinition:
    """Builds one normalized course from its presentation and executable definitions."""

    presentation = json.loads(presentation_path.read_text())
    lessons = tuple(
        _build_lesson(
            item,
            source_lessons,
            source_assets,
            source_exams,
            runner_id,
            language,
            default_runtime,
            cache_dir,
            asset_materializer,
        )
        for item in presentation["lessons"]
    )
    chapters = tuple(
        ChapterDefinition(str(item["id"]), item["title"], tuple(item["lessonIds"]))
        for item in presentation["chapters"]
    )
    glossary = tuple(
        GlossaryEntry(
            terms=tuple(item["terms"]),
            label=item["label"],
            definition=item["definition"],
            external_url=item.get("externalUrl"),
        )
        for item in presentation["glossary"]
    )
    return CourseDefinition(
        course_id=course_id,
        title=title,
        help_instructions=help_instructions,
        runtime_dir=presentation_path.parent / "var",
        asset_presentation=asset_presentation,
        chapters=chapters,
        lessons=lessons,
        glossary=glossary,
    )


def _build_lesson(
    item: dict[str, Any],
    source_lessons: dict[str, Any],
    source_assets: dict[str, Any],
    source_exams: dict[str, Any],
    runner_id: str,
    language: str,
    default_runtime: str,
    cache_dir: str,
    asset_materializer: Callable[[Any, Path], tuple[int, int]],
) -> LessonDefinition:
    lesson_id = item["id"]
    source_lesson = source_lessons[lesson_id]
    source_asset = source_assets[lesson_id]

    def materialize(path: Path, asset: Any = source_asset) -> tuple[int, int]:
        return asset_materializer(asset, path)

    asset = LessonAssetDefinition(
        file_name=source_asset.file_name,
        cache_dir=cache_dir,
        materialize=materialize,
    )
    source_exam = source_exams.get(lesson_id)
    exam = _build_exam(source_exam) if source_exam else None
    return LessonDefinition(
        lesson_id=lesson_id,
        route=item["slug"].removeprefix("/lessons/"),
        title=item["title"],
        file_name=source_lesson.file_name,
        runtime=item.get("runtime", default_runtime),
        language=language,
        concept=tuple(item["concept"]),
        math=tuple(item["math"]),
        exercise=item["exercise"],
        checkpoints=tuple(item["checkpoints"]),
        template=source_lesson.template,
        checks=tuple(LessonCheck(check.label, check.required_text) for check in source_lesson.checks),
        runner_id=getattr(source_lesson, "execution_mode", None) or runner_id,
        asset=asset,
        exam=exam,
    )


def _build_exam(source_exam: Any) -> ExamDefinition:
    return ExamDefinition(
        questions=tuple(
            ExamQuestion(
                question_id=question.question_id,
                prompt=question.prompt,
                options=tuple(ExamOption(option.option_id, option.text) for option in question.options),
                correct_option_id=question.correct_option_id,
            )
            for question in source_exam.questions
        )
    )
