import type {
  AssetFileResponse,
  AssetState,
  OpenAIChatSettings,
  LessonFileResponse,
  LessonFileState,
  LessonOutputResponse,
  RunResult
} from "../api";
import type { Course, CourseSummary } from "../courseTypes";

const courseId = "python-demo";
const lessonId = "1.1";
const fileStorageKey = "learn-preview-python-file-v1";
const fileModifiedStorageKey = "learn-preview-python-file-modified-v1";
const outputStorageKey = "learn-preview-python-output-v1";
const tutorResponse = "This lesson introduces a variable, an f-string, and `print()`. Change the value assigned to `name`, then select **Run** to produce a personalized greeting.";
let chatTurn = 0;

const template = `name = "learner"
print(f"Hello, {name}!")
`;

const assetContent = `Python demo reference

- Variables give values a reusable name.
- f-strings insert expressions between braces.
- print() writes a value to standard output.
`;

const course: Course = {
  id: courseId,
  title: "Python Demo",
  asset: {
    label: "Reference",
    shortLabel: "Reference",
    icon: "book-open",
    previewKind: "text"
  },
  chapters: [{ id: "1", title: "Python basics", lessonIds: [lessonId] }],
  lessons: [
    {
      id: lessonId,
      route: "hello-python",
      slug: `/courses/${courseId}/lessons/hello-python`,
      title: "Hello, Python",
      runtime: "Browser demo",
      language: "python",
      concept: [
        "A variable gives a value a reusable name. An f-string inserts an expression between braces into text. This static preview simulates this lesson's output in the browser; the local app runs the file with Python."
      ],
      math: [],
      exercise: "Change the value assigned to `name`, then run the file to print a personalized greeting.",
      checkpoints: ["Assign a non-empty value to `name`.", "Print the formatted greeting."],
      exam: false
    }
  ],
  glossary: [
    {
      terms: ["variable", "variables"],
      label: "Variable",
      definition: "A named reference to a value."
    },
    {
      terms: ["f-string", "f-strings"],
      label: "F-string",
      definition: "A Python string literal that evaluates expressions written inside braces."
    }
  ]
};

const courseSummary: CourseSummary = {
  id: course.id,
  title: course.title,
  lessonCount: course.lessons.length
};

const chatSettings: OpenAIChatSettings = {
  model: "Python demo tutor",
  provider: "Browser local",
  api: "Simulated responses",
  reasoningEffort: "not applicable",
  store: false,
  streaming: true,
  truncation: "not applicable",
  turnTimeoutSeconds: 0
};

async function previewFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = input instanceof Request ? input : null;
  const url = new URL(input instanceof Request ? input.url : input.toString(), window.location.origin);
  const method = (init?.method ?? request?.method ?? "GET").toUpperCase();

  try {
    if (url.pathname === "/api/courses" && method === "GET") return jsonResponse([courseSummary]);
    if (url.pathname === `/api/courses/${courseId}` && method === "GET") return jsonResponse(course);

    const lessonMatch = url.pathname.match(/^\/api\/courses\/([^/]+)\/lessons\/([^/]+)\/(.+)$/);
    if (lessonMatch) {
      const [, requestedCourseId, requestedLessonId, action] = lessonMatch;
      assertLesson(requestedCourseId, requestedLessonId);
      return await handleLessonRequest(action, method, init, request);
    }

    const chatMatch = url.pathname.match(/^\/api\/courses\/([^/]+)\/openai-chat\/(.+)$/);
    if (chatMatch) {
      const [, requestedCourseId, action] = chatMatch;
      assertCourse(requestedCourseId);
      return await handleChatRequest(action, method, init, request);
    }

    return errorResponse("Unknown preview API route.", 404);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "The preview request failed.", 400);
  }
}

async function handleLessonRequest(
  action: string,
  method: string,
  init: RequestInit | undefined,
  request: Request | null
): Promise<Response> {
  if (action === "file" && method === "GET") return jsonResponse(readLessonFile());
  if (action === "file" && method === "PUT") {
    const body = await readJsonBody<{ content?: string }>(init, request);
    return jsonResponse(saveLessonFile(body.content ?? ""));
  }
  if (action === "file-state" && method === "GET") return jsonResponse(readLessonFileState());
  if (action === "output" && method === "GET") return jsonResponse(readLessonOutput());
  if (action === "reset" && method === "POST") return jsonResponse(resetLessonFile());
  if (action === "run" && method === "POST") return jsonResponse(runLessonFile());
  if (action === "asset/state" && method === "GET") return jsonResponse(readAssetState());
  if (action === "asset/file" && method === "POST") return jsonResponse(readAssetFile());
  if (action === "asset/reset" && method === "POST") return jsonResponse(readAssetState());
  if ((action === "open" || action === "asset/open") && method === "POST") {
    return errorResponse("Opening files in VS Code is available only in the local app.", 409);
  }
  return errorResponse("Unknown preview lesson route.", 404);
}

async function handleChatRequest(
  action: string,
  method: string,
  init: RequestInit | undefined,
  request: Request | null
): Promise<Response> {
  if (action === "settings" && method === "GET") return jsonResponse(chatSettings);
  if (action === "session" && method === "DELETE") {
    chatTurn += 1;
    return emptyResponse();
  }
  if (action === "turn/interrupt" && method === "POST") {
    chatTurn += 1;
    return emptyResponse();
  }
  if (action === "turn" && method === "POST") {
    await readJsonBody(init, request);
    return streamChatResponse();
  }
  return errorResponse("Unknown preview chat route.", 404);
}

function readLessonFile(): LessonFileResponse {
  return {
    content: window.localStorage.getItem(fileStorageKey) ?? template,
    exists: true
  };
}

function readLessonFileState(): LessonFileState {
  const modifiedAt = Number(window.localStorage.getItem(fileModifiedStorageKey));
  return {
    exists: true,
    modifiedAt: Number.isFinite(modifiedAt) && modifiedAt > 0 ? modifiedAt : null
  };
}

function readLessonOutput(): LessonOutputResponse {
  const result = readStoredOutput();
  return { exists: result !== null, result };
}

function saveLessonFile(content: string): LessonFileResponse {
  window.localStorage.setItem(fileStorageKey, content);
  window.localStorage.setItem(fileModifiedStorageKey, String(Date.now()));
  return readLessonFile();
}

function resetLessonFile(): LessonFileResponse {
  window.localStorage.removeItem(fileStorageKey);
  window.localStorage.setItem(fileModifiedStorageKey, String(Date.now()));
  window.localStorage.removeItem(outputStorageKey);
  return readLessonFile();
}

function runLessonFile(): RunResult {
  const content = readLessonFile().content;
  const nameMatch = content.match(/^\s*name\s*=\s*(["'])(.*?)\1\s*$/m);
  const name = nameMatch?.[2].trim() ?? "";
  const hasName = name.length > 0;
  const hasGreeting = /print\s*\(\s*f(["'])Hello,\s*\{name\}!\1\s*\)/m.test(content);
  const success = hasName && hasGreeting;
  const result: RunResult = {
    stdout: success ? `Hello, ${name}!\n` : "",
    stderr: success ? "" : "The browser demo expects a non-empty name and the formatted Hello greeting.\n",
    success,
    checks: [
      { label: "Assign a non-empty value to name.", passed: hasName },
      { label: "Print the formatted greeting.", passed: hasGreeting }
    ]
  };
  window.localStorage.setItem(outputStorageKey, JSON.stringify(result));
  return result;
}

function readAssetState(): AssetState {
  return { exists: true };
}

function readAssetFile(): AssetFileResponse {
  return {
    path: "python-reference.txt",
    content: assetContent,
    truncated: false,
    rows: assetContent.trimEnd().split("\n").length,
    columns: null
  };
}

function readStoredOutput(): RunResult | null {
  const stored = window.localStorage.getItem(outputStorageKey);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as RunResult;
  } catch {
    window.localStorage.removeItem(outputStorageKey);
    return null;
  }
}

function streamChatResponse(): Response {
  const turn = chatTurn + 1;
  chatTurn = turn;
  const chunks = tutorResponse.match(/\S+\s*/g) ?? [tutorResponse];
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of chunks) {
        await waitForChunk();
        if (turn !== chatTurn) {
          controller.enqueue(encoder.encode(`${JSON.stringify({ type: "done" })}\n`));
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: "delta", text: chunk })}\n`));
      }
      controller.enqueue(encoder.encode(`${JSON.stringify({ type: "done" })}\n`));
      controller.close();
    }
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } });
}

async function readJsonBody<T>(init: RequestInit | undefined, request: Request | null): Promise<T> {
  if (typeof init?.body === "string") return JSON.parse(init.body) as T;
  if (request) return request.json() as Promise<T>;
  return {} as T;
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function errorResponse(detail: string, status: number): Response {
  return jsonResponse({ detail }, status);
}

function emptyResponse(): Response {
  return new Response(null, { status: 204 });
}

function waitForChunk(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 24));
}

function assertCourse(requestedCourseId: string): void {
  if (requestedCourseId !== courseId) throw new Error(`Unknown preview course: ${requestedCourseId}`);
}

function assertLesson(requestedCourseId: string, requestedLessonId: string): void {
  assertCourse(requestedCourseId);
  if (requestedLessonId !== lessonId) throw new Error(`Unknown preview lesson: ${requestedLessonId}`);
}

export const apiFetch: typeof fetch = import.meta.env.VITE_STATIC_PREVIEW === "true" ? previewFetch : fetch;
