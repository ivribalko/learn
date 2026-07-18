"""FastAPI application for the shared multi-course Learn website."""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any, Iterator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.assets import asset_exists, materialize_asset, read_asset_metadata, reset_asset
from backend.course_models import CourseDefinition, LessonDefinition
from backend.course_paths import (
    PROJECT_ROOT,
    asset_path,
    lesson_output_path,
    lesson_path,
    lessons_dir,
)
from backend.course_registry import COURSES, get_course, get_runner, runner_health
from backend.course_sync import request_course_sync
from backend.exam_service import answer_exam_question, get_exam_state, reset_exam_answers
from backend.openai_chat import (
    OpenAIChatSessionManager,
    OpenAIChatSettingsResponse,
    chat_stream_event,
)

ASSET_PREVIEW_LINE_LIMIT = 120

app = FastAPI(title="Learn Local API")
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_headers=["*"],
    allow_methods=["*"],
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
)


class LessonFileSaveRequest(BaseModel):
    """Request body for saving editable lesson code."""

    content: str


class LessonFileResponse(BaseModel):
    """Response body containing a lesson file or template preview."""

    content: str
    exists: bool


class LessonFileStateResponse(BaseModel):
    """Response body containing lightweight saved-file metadata."""

    exists: bool
    modifiedAt: float | None


class CheckResult(BaseModel):
    """Response item for one lesson output check."""

    label: str
    passed: bool


class RunFileResponse(BaseModel):
    """Response body containing execution output and lesson checks."""

    stdout: str
    stderr: str
    success: bool
    checks: list[CheckResult]


class LessonOutputResponse(BaseModel):
    """Response body containing the saved last run output."""

    exists: bool
    result: RunFileResponse | None


class AssetResponse(BaseModel):
    """Response body containing lesson-asset state."""

    exists: bool


class AssetFileResponse(BaseModel):
    """Response body containing a bounded lesson-asset preview."""

    path: str
    content: str
    truncated: bool
    rows: int | None = None
    columns: int | None = None


class OpenAIChatTurnRequest(BaseModel):
    """One user turn sent to the active course help thread."""

    lessonId: str
    message: str
    quote: str | None = None


class ExamAnswerRequest(BaseModel):
    """One selected option for a persisted exam question."""

    questionId: str
    optionId: str


OPENAI_CHAT_SESSIONS = OpenAIChatSessionManager()
app.router.add_event_handler("shutdown", OPENAI_CHAT_SESSIONS.shutdown)


@app.get("/api/health")
def health() -> dict[str, str]:
    """Reports available lesson-runner capabilities."""

    return runner_health()


@app.get("/api/courses")
def read_courses() -> list[dict[str, Any]]:
    """Returns summaries for every registered course."""

    return [
        {
            "id": course.course_id,
            "title": course.title,
            "lessonCount": len(course.lessons),
        }
        for course in COURSES.values()
    ]


@app.get("/api/courses/{course_id}")
def read_course(course_id: str) -> dict[str, Any]:
    """Returns the complete public presentation for one course."""

    return _serialize_course(_resolve_course(course_id))


@app.delete("/api/courses/{course_id}/openai-chat/session", status_code=204)
def close_openai_chat_session(course_id: str) -> None:
    """Discards the active in-memory help conversation."""

    _resolve_course(course_id)
    OPENAI_CHAT_SESSIONS.close()


@app.get(
    "/api/courses/{course_id}/openai-chat/settings",
    response_model=OpenAIChatSettingsResponse,
)
def read_openai_chat_settings(course_id: str) -> OpenAIChatSettingsResponse:
    """Returns the configured OpenAI settings used by course help."""

    course = _resolve_course(course_id)
    try:
        return OPENAI_CHAT_SESSIONS.get_or_create(course).settings
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@app.post("/api/courses/{course_id}/openai-chat/turn")
def stream_openai_chat_turn(course_id: str, request: OpenAIChatTurnRequest) -> StreamingResponse:
    """Streams one turn from a course-aware in-memory OpenAI conversation."""

    course, lesson = _resolve_lesson(course_id, request.lessonId)
    try:
        session = OPENAI_CHAT_SESSIONS.get_or_create(course)
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    def events() -> Iterator[str]:
        try:
            yield from session.stream_turn(lesson, request.message, request.quote)
        except GeneratorExit:
            OPENAI_CHAT_SESSIONS.close(session)
            raise
        except RuntimeError as error:
            OPENAI_CHAT_SESSIONS.close(session)
            yield chat_stream_event("error", message=str(error))

    return StreamingResponse(events(), media_type="application/x-ndjson")


@app.post("/api/courses/{course_id}/openai-chat/turn/interrupt", status_code=204)
def interrupt_openai_chat_turn(course_id: str) -> None:
    """Stops the active API response while preserving completed turns."""

    _resolve_course(course_id)
    try:
        OPENAI_CHAT_SESSIONS.interrupt_turn()
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@app.get("/api/courses/{course_id}/lessons/{lesson_id}/exam")
def read_exam(course_id: str, lesson_id: str) -> dict[str, Any]:
    """Returns an exam and its persisted answers."""

    course, lesson = _resolve_lesson(course_id, lesson_id)
    try:
        return get_exam_state(course, lesson)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.post("/api/courses/{course_id}/lessons/{lesson_id}/exam/answer")
def answer_exam(course_id: str, lesson_id: str, request: ExamAnswerRequest) -> dict[str, Any]:
    """Stores and evaluates the first selected exam answer."""

    course, lesson = _resolve_lesson(course_id, lesson_id)
    try:
        return answer_exam_question(course, lesson, request.questionId, request.optionId)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.get(
    "/api/courses/{course_id}/lessons/{lesson_id}/file",
    response_model=LessonFileResponse,
)
def read_lesson_file(course_id: str, lesson_id: str) -> LessonFileResponse:
    """Returns saved lesson contents or its template."""

    course, lesson = _resolve_lesson(course_id, lesson_id)
    path = lesson_path(course, lesson)
    content = path.read_text() if path.exists() else lesson.template
    return LessonFileResponse(
        content=_normalize_lesson_content(content),
        exists=path.exists(),
    )


@app.get(
    "/api/courses/{course_id}/lessons/{lesson_id}/file-state",
    response_model=LessonFileStateResponse,
)
def read_lesson_file_state(course_id: str, lesson_id: str) -> LessonFileStateResponse:
    """Returns lesson-file metadata without reading its content."""

    course, lesson = _resolve_lesson(course_id, lesson_id)
    path = lesson_path(course, lesson)
    return LessonFileStateResponse(
        exists=path.exists(),
        modifiedAt=path.stat().st_mtime if path.exists() else None,
    )


@app.get(
    "/api/courses/{course_id}/lessons/{lesson_id}/output",
    response_model=LessonOutputResponse,
)
def read_lesson_output(course_id: str, lesson_id: str) -> LessonOutputResponse:
    """Returns the persisted last run result."""

    course, lesson = _resolve_lesson(course_id, lesson_id)
    path = lesson_output_path(course, lesson)
    if not path.exists():
        return LessonOutputResponse(
            exists=False,
            result=None,
        )
    try:
        result = RunFileResponse.model_validate_json(path.read_text())
    except (ValueError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=500, detail="Saved lesson output could not be read.") from error
    return LessonOutputResponse(
        exists=True,
        result=result,
    )


@app.get(
    "/api/courses/{course_id}/lessons/{lesson_id}/asset/state",
    response_model=AssetResponse,
)
def read_asset_state(course_id: str, lesson_id: str) -> AssetResponse:
    """Returns generated lesson-asset state."""

    course, lesson = _resolve_lesson(course_id, lesson_id)
    return _asset_response(course, lesson)


@app.post(
    "/api/courses/{course_id}/lessons/{lesson_id}/asset/file",
    response_model=AssetFileResponse,
)
def read_asset_file(course_id: str, lesson_id: str) -> AssetFileResponse:
    """Ensures a lesson asset exists and returns a bounded preview."""

    course, lesson = _resolve_lesson(course_id, lesson_id)
    path = _ensure_asset(course, lesson)
    metadata = read_asset_metadata(course, lesson)
    lines = path.read_text().splitlines()
    preview_lines = lines[:ASSET_PREVIEW_LINE_LIMIT]
    return AssetFileResponse(
        path=_display_path(path),
        content="\n".join(preview_lines),
        truncated=len(lines) > len(preview_lines),
        rows=_int_metadata(metadata.get("rows")),
        columns=_int_metadata(metadata.get("columns")),
    )


@app.post(
    "/api/courses/{course_id}/lessons/{lesson_id}/asset/reset",
    response_model=AssetResponse,
)
def reset_lesson_asset(course_id: str, lesson_id: str) -> AssetResponse:
    """Deletes one generated lesson asset."""

    course, lesson = _resolve_lesson(course_id, lesson_id)
    reset_asset(course, lesson)
    return _asset_response(course, lesson)


@app.post(
    "/api/courses/{course_id}/lessons/{lesson_id}/asset/open",
    response_model=AssetFileResponse,
)
def open_asset_in_vscode(course_id: str, lesson_id: str) -> AssetFileResponse:
    """Ensures and opens one lesson asset in VS Code."""

    asset_file = read_asset_file(course_id, lesson_id)
    _open_in_vscode(PROJECT_ROOT / asset_file.path)
    return asset_file


@app.post(
    "/api/courses/{course_id}/lessons/{lesson_id}/open",
    response_model=LessonFileResponse,
)
def open_lesson_in_vscode(course_id: str, lesson_id: str) -> LessonFileResponse:
    """Ensures and opens one editable lesson file in VS Code."""

    course, lesson = _resolve_lesson(course_id, lesson_id)
    path = _ensure_lesson_file(course, lesson)
    _open_in_vscode(path)
    return LessonFileResponse(
        content=_normalize_lesson_content(path.read_text()),
        exists=True,
    )


@app.put(
    "/api/courses/{course_id}/lessons/{lesson_id}/file",
    response_model=LessonFileResponse,
)
def save_lesson_file(course_id: str, lesson_id: str, request: LessonFileSaveRequest) -> LessonFileResponse:
    """Writes browser editor content to one course-scoped lesson file."""

    course, lesson = _resolve_lesson(course_id, lesson_id)
    path = lesson_path(course, lesson)
    path.parent.mkdir(parents=True, exist_ok=True)
    content = _normalize_lesson_content(request.content)
    path.write_text(content)
    return LessonFileResponse(
        content=content,
        exists=True,
    )


@app.post(
    "/api/courses/{course_id}/lessons/{lesson_id}/reset",
    response_model=LessonFileResponse,
)
def reset_lesson_file(course_id: str, lesson_id: str) -> LessonFileResponse:
    """Deletes lesson source, output, runner artifacts, and exam answers."""

    course, lesson = _resolve_lesson(course_id, lesson_id)
    path = lesson_path(course, lesson)
    for target in (path, lesson_output_path(course, lesson)):
        if target.exists():
            target.unlink()
    get_runner(lesson.runner_id).reset(course, lesson)
    reset_exam_answers(course, lesson)
    return LessonFileResponse(
        content=_normalize_lesson_content(lesson.template),
        exists=False,
    )


@app.post(
    "/api/courses/{course_id}/lessons/{lesson_id}/run",
    response_model=RunFileResponse,
)
def run_lesson_file(course_id: str, lesson_id: str) -> RunFileResponse:
    """Ensures lesson resources, dispatches its runner, and evaluates checks."""

    course, lesson = _resolve_lesson(course_id, lesson_id)
    path = _ensure_lesson_file(course, lesson)
    _ensure_asset(course, lesson)
    try:
        execution = get_runner(lesson.runner_id).run(course, lesson, path)
    except (KeyError, RuntimeError) as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    combined_output = f"{execution.stdout}\n{execution.stderr}"
    checks = [
        CheckResult(label=check.label, passed=check.required_text in combined_output)
        for check in lesson.checks
    ]
    result = RunFileResponse(
        stdout=execution.stdout,
        stderr=execution.stderr,
        success=execution.exit_code == 0,
        checks=checks,
    )
    output_path = lesson_output_path(course, lesson)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(result.model_dump_json(indent=2))
    request_course_sync()
    return result


def _resolve_course(course_id: str) -> CourseDefinition:
    try:
        return get_course(course_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=f"Unknown course: {course_id}") from error


def _resolve_lesson(course_id: str, lesson_id: str) -> tuple[CourseDefinition, LessonDefinition]:
    course = _resolve_course(course_id)
    try:
        return course, course.lesson(lesson_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=f"Unknown lesson: {lesson_id}") from error


def _ensure_lesson_file(course: CourseDefinition, lesson: LessonDefinition) -> Path:
    path = lesson_path(course, lesson)
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text(_normalize_lesson_content(lesson.template))
    return path


def _ensure_asset(course: CourseDefinition, lesson: LessonDefinition) -> Path:
    if asset_exists(course, lesson):
        return asset_path(course, lesson)
    path, _, _ = materialize_asset(course, lesson)
    return path


def _open_in_vscode(path: Path) -> None:
    code_command = _find_code_command()
    if code_command is None:
        raise HTTPException(status_code=500, detail="VS Code CLI `code` was not found.")
    subprocess.Popen([code_command, "--reuse-window", str(PROJECT_ROOT), "--goto", str(path)], cwd=PROJECT_ROOT)


def _serialize_course(course: CourseDefinition) -> dict[str, Any]:
    return {
        "id": course.course_id,
        "title": course.title,
        "asset": {
            "label": course.asset_presentation.label,
            "shortLabel": course.asset_presentation.short_label,
            "icon": course.asset_presentation.icon,
            "previewKind": course.asset_presentation.preview_kind,
        },
        "chapters": [
            {"id": chapter.chapter_id, "title": chapter.title, "lessonIds": list(chapter.lesson_ids)}
            for chapter in course.chapters
        ],
        "lessons": [
            {
                "id": lesson.lesson_id,
                "route": lesson.route,
                "slug": f"/courses/{course.course_id}/lessons/{lesson.route}",
                "title": lesson.title,
                "runtime": lesson.runtime,
                "language": lesson.language,
                "concept": list(lesson.concept),
                "math": list(lesson.math),
                "exercise": lesson.exercise,
                "checkpoints": list(lesson.checkpoints),
                "exam": lesson.exam is not None,
            }
            for lesson in course.lessons
        ],
        "glossary": [
            {
                "terms": list(entry.terms),
                "label": entry.label,
                "definition": entry.definition,
                **({"externalUrl": entry.external_url} if entry.external_url else {}),
            }
            for entry in course.glossary
        ],
    }


def _asset_response(course: CourseDefinition, lesson: LessonDefinition) -> AssetResponse:
    return AssetResponse(exists=asset_exists(course, lesson))


def _normalize_lesson_content(content: str) -> str:
    return content.rstrip("\n") + "\n"


def _display_path(path: Path) -> str:
    return str(path.relative_to(PROJECT_ROOT))


def _find_code_command() -> str | None:
    return shutil.which("code")


def _int_metadata(value: object) -> int | None:
    return value if isinstance(value, int) else None
