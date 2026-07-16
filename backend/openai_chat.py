"""Ephemeral OpenAI Responses API sessions for course help chat."""

from __future__ import annotations

import json
import os
import threading
from typing import Any, Iterator

from openai import OpenAI, OpenAIError, Stream
from openai.types.responses import (
    Response,
    ResponseCompletedEvent,
    ResponseErrorEvent,
    ResponseFailedEvent,
    ResponseIncompleteEvent,
    ResponseStreamEvent,
    ResponseTextDeltaEvent,
)
from pydantic import BaseModel

from backend.course_models import CourseDefinition, LessonDefinition
from backend.course_paths import lesson_path

OPENAI_CHAT_MODEL = "gpt-5.6-sol"
OPENAI_CHAT_REASONING_EFFORT = "low"
OPENAI_CHAT_TURN_TIMEOUT_SECONDS = 120


class OpenAIChatSettingsResponse(BaseModel):
    """Configured OpenAI API settings displayed by the help chat."""

    model: str
    provider: str
    api: str
    reasoningEffort: str
    store: bool
    streaming: bool
    truncation: str
    turnTimeoutSeconds: int


class OpenAIChatSession:
    """Owns one course-aware, non-persisted Responses API conversation."""

    def __init__(self, course: CourseDefinition) -> None:
        self.course_id = course.course_id
        self.settings = OpenAIChatSettingsResponse(
            model=OPENAI_CHAT_MODEL,
            provider="OpenAI",
            api="Responses",
            reasoningEffort=OPENAI_CHAT_REASONING_EFFORT,
            store=False,
            streaming=True,
            truncation="auto",
            turnTimeoutSeconds=OPENAI_CHAT_TURN_TIMEOUT_SECONDS,
        )
        self._client = OpenAI(
            api_key=_read_openai_api_key(),
            max_retries=1,
            timeout=OPENAI_CHAT_TURN_TIMEOUT_SECONDS,
        )
        self._course = course
        self._help_instructions = course.help_instructions
        self._history: list[Any] = []
        self._closed = False
        self._turn_lock = threading.Lock()
        self._active_stream_lock = threading.Lock()
        self._active_stream: Stream[ResponseStreamEvent] | None = None
        self._cancel_active_turn = threading.Event()

    def stream_turn(
        self,
        lesson: LessonDefinition,
        message: str,
        quote: str | None,
    ) -> Iterator[str]:
        """Yields NDJSON text deltas while retaining complete response items in memory."""

        with self._turn_lock:
            if self._closed:
                raise RuntimeError("The OpenAI chat session is closed.")

            user_input = {
                "role": "user",
                "content": _openai_turn_text(self._course, lesson, message, quote),
            }
            turn_input = [*self._history, user_input]
            completed_response: Response | None = None
            streamed_text = ""
            stream: Stream[ResponseStreamEvent] | None = None
            self._cancel_active_turn.clear()

            try:
                stream = self._client.responses.create(
                    model=OPENAI_CHAT_MODEL,
                    instructions=self._help_instructions,
                    input=turn_input,
                    reasoning={"effort": OPENAI_CHAT_REASONING_EFFORT},
                    store=False,
                    stream=True,
                    truncation="auto",
                )
                self._set_active_stream(stream)

                for event in stream:
                    if self._cancel_active_turn.is_set():
                        self._save_interrupted_turn(turn_input, streamed_text)
                        yield chat_stream_event("done")
                        return
                    if isinstance(event, ResponseTextDeltaEvent) and event.delta:
                        streamed_text += event.delta
                        yield chat_stream_event("delta", text=event.delta)
                    elif isinstance(event, ResponseCompletedEvent):
                        completed_response = event.response
                    elif isinstance(event, ResponseFailedEvent):
                        raise RuntimeError(_response_error(event.response))
                    elif isinstance(event, ResponseIncompleteEvent):
                        raise RuntimeError(_incomplete_response_error(event.response))
                    elif isinstance(event, ResponseErrorEvent):
                        raise RuntimeError(event.message)

                if self._cancel_active_turn.is_set():
                    self._save_interrupted_turn(turn_input, streamed_text)
                    yield chat_stream_event("done")
                    return
                if completed_response is None:
                    raise RuntimeError("OpenAI stopped before completing its response.")

                self._history = [*turn_input, *completed_response.output]
                yield chat_stream_event("done")
            except RuntimeError:
                if self._cancel_active_turn.is_set():
                    self._save_interrupted_turn(turn_input, streamed_text)
                    yield chat_stream_event("done")
                    return
                raise
            except Exception as error:
                if self._cancel_active_turn.is_set():
                    self._save_interrupted_turn(turn_input, streamed_text)
                    yield chat_stream_event("done")
                    return
                if isinstance(error, OpenAIError):
                    raise RuntimeError(f"OpenAI API request failed: {error}") from error
                raise RuntimeError(f"OpenAI response stream failed: {error}") from error
            finally:
                self._clear_active_stream(stream)
                if stream is not None:
                    stream.close()

    def interrupt_turn(self) -> bool:
        """Stops the active API response without discarding earlier conversation state."""

        self._cancel_active_turn.set()
        with self._active_stream_lock:
            stream = self._active_stream
        if stream is None:
            return False
        stream.close()
        return True

    def close(self) -> None:
        """Cancels active work and discards all in-memory conversation state."""

        if self._closed:
            return
        self._closed = True
        self.interrupt_turn()
        self._history.clear()
        self._client.close()

    def _set_active_stream(self, stream: Stream[ResponseStreamEvent]) -> None:
        """Publishes the current stream so another request can interrupt it."""

        with self._active_stream_lock:
            self._active_stream = stream
            should_close = self._closed or self._cancel_active_turn.is_set()
        if should_close:
            stream.close()

    def _clear_active_stream(self, stream: Stream[ResponseStreamEvent] | None) -> None:
        """Forgets a completed stream without clearing a newer one."""

        with self._active_stream_lock:
            if self._active_stream is stream:
                self._active_stream = None

    def _save_interrupted_turn(self, turn_input: list[Any], streamed_text: str) -> None:
        """Retains the user turn and any partial answer visible in the frontend."""

        self._history = [*turn_input]
        if streamed_text:
            self._history.append({"role": "assistant", "content": streamed_text})


class OpenAIChatSessionManager:
    """Owns the application's one lazily created OpenAI chat session."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._session: OpenAIChatSession | None = None

    def get_or_create(self, course: CourseDefinition) -> OpenAIChatSession:
        """Returns the active session or creates one for the requested course."""

        with self._lock:
            if self._session is not None and self._session.course_id != course.course_id:
                self._session.close()
                self._session = None
            if self._session is None:
                self._session = OpenAIChatSession(course)
            return self._session

    def interrupt_turn(self) -> bool:
        """Interrupts the active response when a session exists."""

        with self._lock:
            session = self._session
        return session.interrupt_turn() if session is not None else False

    def close(self, expected_session: OpenAIChatSession | None = None) -> None:
        """Discards the active or expected conversation and releases its API client."""

        with self._lock:
            if expected_session is not None and self._session is not expected_session:
                return
            session = self._session
            self._session = None
        if session is not None:
            session.close()

    def shutdown(self) -> None:
        """Releases the active client during backend shutdown."""

        self.close()


def chat_stream_event(event_type: str, **payload: str) -> str:
    """Serializes one frontend chat stream event as NDJSON."""

    return json.dumps({"type": event_type, **payload}) + "\n"


def _read_openai_api_key() -> str:
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if key:
        return key
    raise RuntimeError("OpenAI API key not found. Set OPENAI_API_KEY.")


def _openai_turn_text(
    course: CourseDefinition,
    lesson: LessonDefinition,
    message: str,
    quote: str | None,
) -> str:
    context = _lesson_context(course, lesson)
    quote_context = f"\n\nSelected text (reference context only):\n{quote}" if quote else ""
    return f"{context}{quote_context}\n\nLearner message:\n{message}"


def _lesson_context(course: CourseDefinition, lesson: LessonDefinition) -> str:
    path = lesson_path(course, lesson)
    file_content = path.read_text() if path.is_file() else lesson.template
    sections = [
        "Current lesson (reference context only):",
        f"Course: {course.title}",
        f"Lesson: {lesson.title}",
        f"Runtime: {lesson.runtime}",
        f"Language: {lesson.language}",
        "Concept:\n" + "\n".join(lesson.concept),
        "Exercise:\n" + lesson.exercise,
        "Checkpoints:\n" + "\n".join(f"- {item}" for item in lesson.checkpoints),
        f"Current lesson file:\n```{lesson.language}\n{file_content.rstrip()}\n```",
    ]
    if lesson.math:
        sections.insert(-2, "Math:\n" + "\n".join(lesson.math))
    return "\n\n".join(sections)


def _response_error(response: Response) -> str:
    error = response.error
    return error.message if error is not None else "OpenAI could not complete this response."


def _incomplete_response_error(response: Response) -> str:
    details = response.incomplete_details
    if details is not None and details.reason == "max_output_tokens":
        return "OpenAI reached the maximum output length before finishing its response."
    if details is not None and details.reason == "content_filter":
        return "OpenAI stopped the response because of its content filter."
    return "OpenAI stopped before completing its response."
