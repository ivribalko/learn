import type { Course, CourseProgress, CourseSummary } from "./courseTypes";
import { apiFetch as fetch } from "./preview/apiFetch";

export type LessonFileResponse = {
  content: string;
  exists: boolean;
};

export type LessonFileState = {
  exists: boolean;
  modifiedAt: number | null;
};

export type RunResult = {
  stdout: string;
  stderr: string;
  success: boolean;
  checks: { label: string; passed: boolean }[];
};

export type LessonOutputResponse = {
  exists: boolean;
  result: RunResult | null;
};

export type AssetState = {
  exists: boolean;
};

export type AssetFileResponse = {
  path: string;
  content: string;
  truncated: boolean;
  rows: number | null;
  columns: number | null;
};

export type OpenAIChatMessage = {
  role: "user" | "assistant";
  content: string;
  quote?: string;
};

export type OpenAIChatSettings = {
  model: string;
  provider: string;
  api: string;
  reasoningEffort: string;
  store: boolean;
  streaming: boolean;
  truncation: string;
  turnTimeoutSeconds: number;
};

export type ExamOption = { id: string; text: string };

export type ExamQuestion = {
  id: string;
  prompt: string;
  options: ExamOption[];
  selectedOptionId: string | null;
  correct: boolean | null;
  correctOptionId: string | null;
};

export type ExamState = {
  answeredCount: number;
  correctCount: number;
  questions: ExamQuestion[];
};

type OpenAIChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

async function parseJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T;
  if (!response.ok) {
    const detail = typeof data === "object" && data && "detail" in data ? String(data.detail) : response.statusText;
    throw new Error(detail);
  }
  return data;
}

const lessonUrl = (courseId: string, lessonId: string, suffix: string) =>
  `/api/courses/${courseId}/lessons/${lessonId}/${suffix}`;

export async function fetchCourses(): Promise<CourseSummary[]> {
  return parseJson<CourseSummary[]>(await fetch("/api/courses"));
}

export async function fetchCourse(courseId: string): Promise<Course> {
  return parseJson<Course>(await fetch(`/api/courses/${courseId}`));
}

export async function fetchCourseProgress(courseId: string): Promise<CourseProgress> {
  return parseJson<CourseProgress>(await fetch(`/api/courses/${courseId}/progress`));
}

export async function fetchLessonFile(courseId: string, lessonId: string): Promise<LessonFileResponse> {
  return parseJson<LessonFileResponse>(await fetch(lessonUrl(courseId, lessonId, "file")));
}

export async function fetchLessonFileState(courseId: string, lessonId: string): Promise<LessonFileState> {
  return parseJson<LessonFileState>(await fetch(lessonUrl(courseId, lessonId, "file-state")));
}

export async function fetchLessonOutput(courseId: string, lessonId: string): Promise<LessonOutputResponse> {
  return parseJson<LessonOutputResponse>(await fetch(lessonUrl(courseId, lessonId, "output")));
}

export async function openInVSCode(courseId: string, lessonId: string): Promise<LessonFileResponse> {
  return parseJson<LessonFileResponse>(await fetch(lessonUrl(courseId, lessonId, "open"), { method: "POST" }));
}

export async function saveLessonFile(courseId: string, lessonId: string, content: string): Promise<LessonFileResponse> {
  return parseJson<LessonFileResponse>(
    await fetch(lessonUrl(courseId, lessonId, "file"), {
      body: JSON.stringify({ content }),
      headers: { "Content-Type": "application/json" },
      method: "PUT"
    })
  );
}

export async function resetLessonFile(courseId: string, lessonId: string): Promise<LessonFileResponse> {
  return parseJson<LessonFileResponse>(await fetch(lessonUrl(courseId, lessonId, "reset"), { method: "POST" }));
}

export async function runLessonFile(courseId: string, lessonId: string): Promise<RunResult> {
  return parseJson<RunResult>(await fetch(lessonUrl(courseId, lessonId, "run"), { method: "POST" }));
}

export async function fetchAssetState(courseId: string, lessonId: string): Promise<AssetState> {
  return parseJson<AssetState>(await fetch(lessonUrl(courseId, lessonId, "asset/state")));
}

export async function fetchAssetFile(courseId: string, lessonId: string): Promise<AssetFileResponse> {
  return parseJson<AssetFileResponse>(await fetch(lessonUrl(courseId, lessonId, "asset/file"), { method: "POST" }));
}

export async function resetAsset(courseId: string, lessonId: string): Promise<AssetState> {
  return parseJson<AssetState>(await fetch(lessonUrl(courseId, lessonId, "asset/reset"), { method: "POST" }));
}

export async function openAssetInVSCode(courseId: string, lessonId: string): Promise<AssetFileResponse> {
  return parseJson<AssetFileResponse>(await fetch(lessonUrl(courseId, lessonId, "asset/open"), { method: "POST" }));
}

export async function fetchExam(courseId: string, lessonId: string): Promise<ExamState> {
  return parseJson<ExamState>(await fetch(lessonUrl(courseId, lessonId, "exam")));
}

export async function answerExamQuestion(
  courseId: string,
  lessonId: string,
  questionId: string,
  optionId: string
): Promise<ExamQuestion> {
  return parseJson<ExamQuestion>(
    await fetch(lessonUrl(courseId, lessonId, "exam/answer"), {
      body: JSON.stringify({ questionId, optionId }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    })
  );
}

export async function closeOpenAIChatSession(courseId: string, keepalive = false): Promise<void> {
  await ensureOk(await fetch(`/api/courses/${courseId}/openai-chat/session`, { keepalive, method: "DELETE" }));
}

export async function fetchOpenAIChatSettings(courseId: string): Promise<OpenAIChatSettings> {
  return parseJson<OpenAIChatSettings>(await fetch(`/api/courses/${courseId}/openai-chat/settings`));
}

export async function interruptOpenAIChatTurn(courseId: string): Promise<void> {
  await ensureOk(await fetch(`/api/courses/${courseId}/openai-chat/turn/interrupt`, { method: "POST" }));
}

export async function streamOpenAIChatTurn(
  courseId: string,
  lessonId: string,
  message: string,
  quote: string | undefined,
  onDelta: (text: string) => void
): Promise<void> {
  const response = await fetch(`/api/courses/${courseId}/openai-chat/turn`, {
    body: JSON.stringify({ lessonId, message, quote }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });
  await ensureOk(response);
  if (!response.body) throw new Error("The browser could not read the OpenAI response stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;
  while (true) {
    const result = await reader.read();
    buffer += decoder.decode(result.value, { stream: !result.done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) completed = handleOpenAIStreamEvent(line, onDelta) || completed;
    if (result.done) break;
  }
  if (buffer.trim()) completed = handleOpenAIStreamEvent(buffer, onDelta) || completed;
  if (!completed) throw new Error("OpenAI stopped before completing its response.");
}

async function ensureOk(response: Response): Promise<void> {
  if (response.ok) return;
  let detail = response.statusText;
  try {
    const data = (await response.json()) as { detail?: string };
    detail = data.detail ?? detail;
  } catch {
    // Preserve the HTTP status text when the response has no JSON body.
  }
  throw new Error(detail);
}

function handleOpenAIStreamEvent(line: string, onDelta: (text: string) => void): boolean {
  if (!line.trim()) return false;
  const event = JSON.parse(line) as OpenAIChatStreamEvent;
  if (event.type === "delta") onDelta(event.text);
  if (event.type === "error") throw new Error(event.message);
  return event.type === "done";
}
