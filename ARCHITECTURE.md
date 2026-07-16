# Architecture

## Folder Layout

- `frontend/` contains the shared Vite, React, and TypeScript application.
- `frontend/src/preview/` contains the static demo course, browser persistence, simulated runner, and demo chat transport.
- `backend/` contains the FastAPI service, normalized course models, course loader, runner plugins, persistence services, and reusable course builder.
- `courses/` is the optional ignored course checkout.
- `courses/var/<course-id>/` contains ignored editable lessons, generated assets, run output, exam answers, and disposable builds.
- `var/` contains ignored machine-local configuration for the shared application.

## Course Contract

- `backend/course_registry.py` loads the ordered `CourseDefinition` values from `courses.registry.COURSES`; invalid values and duplicate course IDs stop backend startup with a clear error.
- A missing checkout produces an empty catalog, while a missing dependency inside an installed checkout is treated as a configuration error.
- `backend/course_builder.py` adapts authored presentation data and executable definitions into the normalized shared model.
- Course-specific Python dependencies are declared by the checkout rather than the base application.

## Browser Flow

- `/` renders course selection and reports when no courses are installed.
- `/courses/:courseId/lessons/:lessonRoute` renders the shared lesson page.
- `/courses/:courseId/lessons/:lessonRoute/chat` opens that lesson's help conversation as a browser-history entry.
- Selecting a course resumes its browser-stored active lesson, and progress is namespaced by course.
- Unknown courses return to course selection; unknown lessons open the selected course's first lesson.
- The frontend dispatches syntax coloring by lesson language and renders course-provided asset presentation metadata.

## Lesson and Asset Flow

- File, output, exam, run, reset, open, and asset operations are scoped below `/api/courses/{courseId}/lessons/{lessonId}/`.
- Run creates missing source and asset files, invokes the selected runner, evaluates normalized output checks, and persists the result.
- Restart removes source, output, runner artifacts, exam answers, and completion state.
- Shared Python and C++20 runners execute through the project virtual environment and detected host compiler respectively.

## Help Chat

- The floating help view stores its active conversation in React memory.
- The backend lazily creates one OpenAI Responses API session with instructions supplied by the active course.
- Every turn includes the active lesson's normalized teaching content and current editable file so the API remains grounded without local filesystem tools.
- Each request uses `store=false`; the backend replays complete response output items from memory so reasoning context is retained without persisting a conversation at OpenAI.
- Changing courses replaces the in-memory session on the next help turn; `New chat` and page close discard it explicitly.
- The backend streams output-text deltas to the browser and closes the active API stream when the user stops a response.
- Selected lesson or editor text is attached as quoted context to the next message.

## GitHub Pages Preview

- `.github/workflows/pages.yml` builds the frontend with the repository-specific `/learn/` asset and router base path.
- The preview build replaces API calls used by one authored Python demo lesson with browser-local data, editing, reference content, simulated output, and deterministic streamed tutor responses.
- The Pages artifact contains only frontend files; course data, the FastAPI service, runners, generated state, and Help chat remain local.
- A copy of the entry document is published as `404.html` so GitHub Pages can return the React application for client-side routes.

## Local Services

- Vite serves the frontend on `5173` and proxies `/api` to FastAPI on `127.0.0.1:8000`.
- Both development servers start from the repository root with `npm run backend` and `npm run dev`.
- FastAPI runs with file watching through the backend script.
- Course help reads the API key from `OPENAI_API_KEY`.
- Host tools remain available to runner plugins, so the base does not require a containerized runtime.

## Production Container

- `Dockerfile` builds the real Vite frontend and copies it into a Python runtime containing FastAPI, the project virtual environment, and Clang.
- `backend/production.py` serves static frontend assets and client-side routes from the same process and origin as `/api`.
- The production command runs one uvicorn worker without file watching so the in-memory Help chat session remains coherent.
- The ignored course checkout is excluded from the image and mounted read-write at `/app/courses`; lesson files and generated state remain in that volume.
- The Docker entrypoint installs dependencies declared by the mounted course checkout before importing its registry and starting the service.
- `.github/workflows/container.yml` publishes latest and commit tags for Linux AMD64 and ARM64 to GitHub Container Registry on every push to `main`.
