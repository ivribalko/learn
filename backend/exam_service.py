"""Course-scoped exam answer persistence and serialization."""

from __future__ import annotations

import json
import threading
from typing import Any

from backend.course_models import CourseDefinition, ExamQuestion, LessonDefinition
from backend.course_paths import lesson_answers_path


EXAM_LOCK = threading.Lock()


def get_exam_state(course: CourseDefinition, lesson: LessonDefinition) -> dict[str, Any]:
    """Returns public exam questions combined with persisted answers."""

    exam = _require_exam(lesson)
    with EXAM_LOCK:
        answers = _read_answers(course, lesson)
    questions = [_serialize_question(question, answers.get(question.question_id)) for question in exam.questions]
    return {
        "answeredCount": sum(question["selectedOptionId"] is not None for question in questions),
        "correctCount": sum(question["correct"] is True for question in questions),
        "questions": questions,
    }


def answer_exam_question(
    course: CourseDefinition,
    lesson: LessonDefinition,
    question_id: str,
    option_id: str,
) -> dict[str, Any]:
    """Persists the first answer to a question and returns its evaluated state."""

    exam = _require_exam(lesson)
    question = next((item for item in exam.questions if item.question_id == question_id), None)
    if question is None:
        raise KeyError("Unknown exam question.")
    if option_id not in {option.option_id for option in question.options}:
        raise ValueError("Unknown exam answer option.")
    with EXAM_LOCK:
        answers = _read_answers(course, lesson)
        selected_option_id = answers.setdefault(question_id, option_id)
        _write_answers(course, lesson, answers)
    return _serialize_question(question, selected_option_id)


def reset_exam_answers(course: CourseDefinition, lesson: LessonDefinition) -> None:
    """Deletes persisted answers for an exam lesson."""

    if lesson.exam is None:
        return
    with EXAM_LOCK:
        path = lesson_answers_path(course, lesson)
        if path.exists():
            path.unlink()


def _require_exam(lesson: LessonDefinition):
    if lesson.exam is None:
        raise KeyError("Unknown exam lesson.")
    return lesson.exam


def _read_answers(course: CourseDefinition, lesson: LessonDefinition) -> dict[str, str]:
    path = lesson_answers_path(course, lesson)
    if not path.exists():
        return {}
    try:
        value = json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return {}
    if not isinstance(value, dict):
        return {}
    valid_ids = {question.question_id for question in _require_exam(lesson).questions}
    return {key: item for key, item in value.items() if key in valid_ids and isinstance(item, str)}


def _write_answers(course: CourseDefinition, lesson: LessonDefinition, answers: dict[str, str]) -> None:
    path = lesson_answers_path(course, lesson)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_suffix(".tmp")
    temporary_path.write_text(json.dumps(answers, indent=2, sort_keys=True))
    temporary_path.replace(path)


def _serialize_question(question: ExamQuestion, selected_option_id: str | None) -> dict[str, Any]:
    return {
        "id": question.question_id,
        "prompt": question.prompt,
        "options": [{"id": option.option_id, "text": option.text} for option in question.options],
        "selectedOptionId": selected_option_id,
        "correct": selected_option_id == question.correct_option_id if selected_option_id is not None else None,
        "correctOptionId": question.correct_option_id if selected_option_id is not None else None,
    }
