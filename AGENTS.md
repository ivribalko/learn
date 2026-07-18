# Learn

A mobile-friendly, responsive website engine for hands-on courses with editable, runnable lesson files. The repository checkout provides the development environment; production is deployed from the published containers.

The base repository contains the shared application. During development, it supports an optional course repository checked out at `courses/`; the production stack synchronizes that repository into a persistent Docker volume.

The website contains a course-aware chat page backed by the OpenAI Responses API. Conversation state stays in backend memory, and every API request sets `store=false`.

The frontend-only static demo is published at [ivribalko.github.io/learn](https://ivribalko.github.io/learn/). It previews the interface and is not the production application.

## Development Course Checkout

Clone a compatible course repository into the ignored `courses/` directory:

```sh
git clone <course-repository-url> courses
```

The checkout must be a Python package with a root `registry.py` that exports `COURSES` as an ordered tuple of `CourseDefinition` values and `RUNNERS` as a runner dictionary. Optional Python dependencies belong in `courses/requirements.txt`; install them into the parent backend environment for course imports and asset materialization, while course-owned runner images install the dependencies needed during lesson execution.

## Development Setup

Create the isolated Python environment inside this project:

```sh
python3 -m venv .venv
```

Install the shared backend dependencies:

```sh
.venv/bin/python -m pip install -r backend/requirements.txt
```

Provide an OpenAI API key before starting the backend:

```sh
export OPENAI_API_KEY="<your-openai-api-key>"
```

When a course checkout is installed, install its dependencies too:

```sh
.venv/bin/python -m pip install -r courses/requirements.txt
```

Install frontend dependencies:

```sh
npm install --prefix frontend
```

Install and start Docker. Course-owned runner images build automatically when a lesson first uses them.

## Development Run

Start the backend:

```sh
npm run backend
```

Start the frontend in another terminal:

```sh
npm run dev
```

Open the site:

```sh
open http://127.0.0.1:5173
```

## Production Deployment

Every push to `main` publishes multi-platform `ghcr.io/ivribalko/learn-site` and `ghcr.io/ivribalko/learn-sync` images. Production hosts pull these images instead of running the development servers. The site image serves the built frontend and API together on port `8000` without file watching or hot reload. The sync image owns the persistent course checkout, commits lesson state, rebases onto `main`, and pushes after completed lesson runs.

GitHub creates each package as private on its first publication. Open both package settings after the first workflow run, change their visibility to **Public**, and rerun the workflow. Public GHCR packages can be pulled anonymously.

The site image does not contain authored courses or lesson toolchains. A standalone deployment must provide a course checkout at `/app/courses`. At startup, the container creates the course runtime directories with application ownership and installs dependencies from the mounted `requirements.txt`; lesson toolchains remain in course-owned runner images.

### Standalone Site Container

Pull the published image:

```sh
docker pull ghcr.io/ivribalko/learn-site:latest
```

Run it with the course checkout mounted read-write so lesson state can persist under each `courses/<course-package>/var/` directory. Mount the host Docker socket and add its group so the app can build and start sibling runner containers:

```sh
docker run --detach --name learn-site --restart unless-stopped --publish 8000:8000 --env OPENAI_API_KEY="<your-openai-api-key>" --group-add "$(stat --format='%g' /var/run/docker.sock)" --volume /var/run/docker.sock:/var/run/docker.sock --volume "<course-checkout>:/app/courses" ghcr.io/ivribalko/learn-site:latest
```

### Docker Compose Stack

[`compose.yaml`](compose.yaml) is the complete production stack. It runs the published `learn-sync` image as a persistent Git service and the published `learn-site` image as the website. The services share the `learn_courses` volume. On startup, `learn-sync` clones the private repository or commits pending volume changes, rebases them onto the latest `origin/main`, and pushes any recovered commit. It becomes healthy only after this initial synchronization.

The stack is self-contained and requires no repository checkout or local image build.

Every exam answer, restart, and lesson run queues a unique request through the shared `learn_courses_sync` volume. The `learn-sync` service stages all nonignored checkout changes, creates a lowercase past-tense `updated state <course-id> <lesson-id>` commit when needed, rebases onto the latest `main`, and pushes directly to `main`. Git failures remain queued for retry.

Configure the Compose environment without committing the values:

```dotenv
COURSES_REPOSITORY=<owner>/<private-course-repository>
GITHUB_TOKEN=<courses-contents-write-token>
OPENAI_API_KEY=<openai-api-key>
```

Open the production site:

```sh
open http://<media-server>:8000
```

Service boundaries, runtime state, request flows, and the Docker runner lifecycle are documented in [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Repository Instructions

- This app is a deployed course runner intended for trusted environments; repository-local execution is for development only, and remote-user security features are out of scope.
- Do not add automated tests.
- For ordinary frontend source or CSS edits, rely on Vite hot reload without building or restarting; build or restart only when explicitly requested, for delivery verification, or when startup/build-time behavior changes.
- Run the backend with file watching using `.venv/bin/python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 --reload`; after backend logic changes, rely on reload instead of manually restarting it.
- Do not perform browser tests, click testing, automated browser checks, or manual browser checks; leave browser verification to the user.
- Do not preserve old behavior, routes, APIs, file formats, UI flows, aliases, redirects, migrations, or backward compatibility.
- Defaulting an unknown course to course selection or an unknown lesson to that course's first lesson is acceptable and is not considered backward compatibility.
- Route errors from frontend controls through the global fixed toast; do not add inline error UI that shifts page layout.
- Button hover states must not change text or icon color; use background, border, or other non-color text treatments instead.
- Form controls must not gain a highlight, focus ring, border-color change, or box shadow when active or focused.
- Do not add accessibility-specific attributes or features.
- Reuse shared components and CSS classes for equivalent behavior and styling; avoid duplicating element logic or visual rules.
- Share repeated CSS values through named custom properties; do not duplicate layout or visual constants across selectors.
- Keep all functional frontend behavior course-agnostic; authored course data belongs in the optional `courses/` checkout.
- Make the help chat visually and behaviorally match the ChatGPT chat experience.
