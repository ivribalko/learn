# Architecture

## Folder Layout

- `frontend/` contains the shared Vite, React, and TypeScript application.
- `frontend/src/preview/` contains the static demo course, browser persistence, simulated runner, and demo chat transport.
- `backend/` contains the FastAPI service, normalized course models, course loader, persistence services, and reusable course builder.
- `courses/` is the optional ignored course checkout and owns authored content, runner dispatch, and lesson-runtime images.
- `courses/<course-package>/var/` contains that course's versioned editable lessons, generated assets, run output, and exam answers.
- `Dockerfile.sync` and `learn-sync.sh` build the dedicated course checkout and push worker image.
- `compose.yaml` runs the published site and sync images without a local build context.
- `var/` contains ignored machine-local configuration for the shared application.

## Course Contract

- `backend/course_registry.py` loads `COURSES` and `RUNNERS` from `courses.registry`; invalid values, missing runner methods, unresolved lesson runner IDs, and duplicate course IDs stop backend startup with a clear error.
- A missing checkout produces an empty catalog, while a missing dependency inside an installed checkout is treated as a configuration error.
- `backend/course_builder.py` adapts authored presentation data and executable definitions into the normalized shared model.
- The builder derives each course's package-local runtime directory from its presentation file location.
- Checkout dependencies, runner implementations, image definitions, and execution commands belong to the checkout rather than the base application.

## Browser Flow

- `/` renders course selection and reports when no courses are installed.
- `/courses/:courseId/lessons/:lessonRoute` renders the shared lesson page.
- `/courses/:courseId/lessons/:lessonRoute/chat` opens that lesson's help conversation as a browser-history entry.
- Selecting a course resumes its browser-stored active lesson, and progress is namespaced by course.
- Unknown courses return to course selection; unknown lessons open the selected course's first lesson.
- The frontend dispatches syntax coloring by lesson language and renders course-provided asset presentation metadata.

## Lesson and Asset Flow

- File, output, exam, run, reset, open, and asset operations are scoped below `/api/courses/{courseId}/lessons/{lessonId}/`.
- Run creates missing source and asset files, invokes the checkout-owned runner, evaluates normalized output checks, and persists the result.
- After the runner finishes and its result is persisted, the backend queues a unique course-repository synchronization request when the Compose trigger volume is configured.
- Restart removes source, output, exam answers, and completion state.
- Lessons execute in Docker images defined by the course checkout; runner tags derive from checkout-owned image and dependency inputs, and each image builds lazily on its first run.
- Runner containers have no network and mount only course runtime state when the backend runs directly on the host.
- Runner timeouts force-remove the named container, and intermediate execution artifacts remain in disposable container storage.
- Runner health reports Docker daemon availability, derived image tags, and whether those images have been built.

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
- The Pages artifact contains only frontend files; course data, the FastAPI service, generated state, and Help chat remain local.
- A copy of the entry document is published as `404.html` so GitHub Pages can return the React application for client-side routes.

## Local Services

- Vite serves the frontend on `5173` and proxies `/api` to FastAPI on `127.0.0.1:8000`.
- Both development servers start from the repository root with `npm run backend` and `npm run dev`.
- FastAPI runs with file watching through the backend script.
- Course help reads the API key from `OPENAI_API_KEY`.
- Docker must be installed and running before a lesson can execute; ordinary backend and frontend startup does not build runner images.

## Production Containers

- `Dockerfile` builds `learn-site` from the real Vite frontend and a Python runtime containing FastAPI, the project virtual environment, and only the Docker client needed for lesson dispatch.
- `Dockerfile.sync` builds `learn-sync` from the pinned Alpine Git image and the course synchronization worker.
- `backend/production.py` serves static frontend assets and client-side routes from the same process and origin as `/api`.
- The production command runs one uvicorn worker without file watching so the in-memory Help chat session remains coherent.
- The ignored course checkout is excluded from the image and mounted read-write at `/app/courses`; lesson files and generated state remain in that volume.
- The Docker entrypoint starts as root, installs dependencies declared by the mounted checkout, creates or repairs ownership of each registered course's package-local `var/` directory, and drops to the unprivileged application user before starting the service.
- The production container receives `/data/docker.sock` at `/var/run/docker.sock` with group `0`. Runner containers inherit `/app/courses` from the app container and run as siblings on that daemon.
- The Compose `learn-sync` service synchronizes the shared checkout with `main` at startup, then commits and pushes all nonignored course changes after each queued lesson run.
- `.github/workflows/container.yml` publishes latest and commit tags for both images on Linux AMD64 and ARM64 to GitHub Container Registry on every push to `main`.
