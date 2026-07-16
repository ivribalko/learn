"""Pluggable subprocess runners for course lesson execution."""

from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from backend.course_models import CourseDefinition, LessonDefinition
from backend.course_paths import PROJECT_ROOT, build_dir, lessons_dir


VENV_PYTHON = PROJECT_ROOT / ".venv" / "bin" / "python"
CPP_COMPILER = shutil.which("clang++")


@dataclass(frozen=True)
class RunnerExecution:
    """Normalized stdout, stderr, and exit code from a runner."""

    stdout: str
    stderr: str
    exit_code: int


class LessonRunner(Protocol):
    """Defines execution and cleanup behavior for one runtime family."""

    def run(self, course: CourseDefinition, lesson: LessonDefinition, path: Path) -> RunnerExecution: ...

    def reset(self, course: CourseDefinition, lesson: LessonDefinition) -> None: ...

    def health(self) -> dict[str, str]: ...


class PythonRunner:
    """Runs Python lessons through the repository-local virtual environment."""

    timeout_seconds = 12

    def run(self, course: CourseDefinition, lesson: LessonDefinition, path: Path) -> RunnerExecution:
        if not VENV_PYTHON.exists():
            raise RuntimeError(
                "Project venv is missing. Create it with `python3 -m venv .venv` and install backend/requirements.txt."
            )
        return _run_process([str(VENV_PYTHON), str(path)], lessons_dir(course), self.timeout_seconds, "Execution")

    def reset(self, course: CourseDefinition, lesson: LessonDefinition) -> None:
        del course, lesson

    def health(self) -> dict[str, str]:
        return {"python": str(VENV_PYTHON), "pythonReady": str(VENV_PYTHON.exists())}


class Cpp20Runner:
    """Compiles C++20 lessons with warnings and runs the resulting executable."""

    compile_timeout_seconds = 30
    run_timeout_seconds = 10

    def run(self, course: CourseDefinition, lesson: LessonDefinition, path: Path) -> RunnerExecution:
        if CPP_COMPILER is None:
            raise RuntimeError("No clang++ compiler was found. Install the Xcode command-line tools first.")
        output_dir = build_dir(course)
        output_dir.mkdir(parents=True, exist_ok=True)
        binary_path = output_dir / Path(lesson.file_name).stem
        compilation = _run_process(
            [
                CPP_COMPILER,
                "-std=c++20",
                "-Wall",
                "-Wextra",
                "-Wpedantic",
                str(path),
                "-o",
                str(binary_path),
            ],
            PROJECT_ROOT,
            self.compile_timeout_seconds,
            "Compilation",
        )
        if compilation.exit_code != 0:
            return compilation
        execution = _run_process(
            [str(binary_path)],
            PROJECT_ROOT,
            self.run_timeout_seconds,
            "Execution",
        )
        stderr = "\n".join(part for part in (compilation.stderr.strip(), execution.stderr.strip()) if part)
        return RunnerExecution(execution.stdout, stderr, execution.exit_code)

    def reset(self, course: CourseDefinition, lesson: LessonDefinition) -> None:
        path = build_dir(course) / Path(lesson.file_name).stem
        if path.exists():
            path.unlink()

    def health(self) -> dict[str, str]:
        return {"compiler": CPP_COMPILER or "", "compilerReady": str(CPP_COMPILER is not None)}


PYTHON_RUNNER = PythonRunner()
CPP_RUNNER = Cpp20Runner()
RUNNERS: dict[str, LessonRunner] = {
    "python": PYTHON_RUNNER,
    "system-cpp": CPP_RUNNER,
    "cpp20": CPP_RUNNER,
}


def get_runner(runner_id: str) -> LessonRunner:
    """Returns a registered lesson runner or raises KeyError."""

    return RUNNERS[runner_id]


def runner_health() -> dict[str, str]:
    """Returns merged capability state for all installed runners."""

    return {**PYTHON_RUNNER.health(), **CPP_RUNNER.health()}


def _run_process(
    command: list[str],
    cwd: Path,
    timeout_seconds: int,
    stage: str,
) -> RunnerExecution:
    try:
        completed = subprocess.run(
            command,
            check=False,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
        )
        return RunnerExecution(completed.stdout, completed.stderr, completed.returncode)
    except subprocess.TimeoutExpired as error:
        stdout = error.stdout if isinstance(error.stdout, str) else ""
        stderr = error.stderr if isinstance(error.stderr, str) else ""
        message = f"{stderr}\n{stage} timed out after {timeout_seconds} seconds.".strip()
        return RunnerExecution(stdout, message, 124)
