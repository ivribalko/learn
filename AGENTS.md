# Learn

A mobile-friendly, responsive, local-first website engine for hands-on courses with editable, runnable lesson files.

The base repository contains the shared application and supports an optional course repository checked out at `courses/`.

The website contains a course-aware chat page backed by the OpenAI Responses API. Conversation state stays in backend memory, and every API request sets `store=false`.

The static demo is published at [ivribalko.github.io/learn](https://ivribalko.github.io/learn/).

## Course Checkout

Clone a compatible course repository into the ignored `courses/` directory:

```sh
git clone <course-repository-url> courses
```

The checkout must be a Python package with a root `registry.py` that exports `COURSES` as an ordered tuple of `CourseDefinition` values and `RUNNERS` as a runner dictionary. Optional Python dependencies belong in `courses/requirements.txt`; install them into the parent backend environment for course imports and asset materialization, while course-owned runner images install the dependencies needed during lesson execution.

## Setup

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

## Run

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

## Production Container

Every push to `main` publishes a multi-platform production image to `ghcr.io/ivribalko/learn`. The image serves the built frontend and API together on port `8000` without file watching or hot reload.

GitHub creates the package as private on its first publication. Open the package settings after that first workflow run, change its visibility to **Public**, and rerun the workflow. Public GHCR packages can be pulled anonymously.

The image does not contain authored courses or lesson toolchains. On the media server, clone the private course repository and mount that checkout at `/app/courses`. At startup, the container creates the ignored course runtime directory with application ownership and installs dependencies from the mounted `requirements.txt`; lesson toolchains remain in course-owned runner images.

Pull the published image:

```sh
docker pull ghcr.io/ivribalko/learn:latest
```

Run it with the course checkout mounted read-write so lesson state can persist under `courses/var/`. Mount the host Docker socket and add its group so the app can build and start sibling runner containers:

```sh
docker run --detach --name learn --restart unless-stopped --publish 8000:8000 --env OPENAI_API_KEY="<your-openai-api-key>" --group-add "$(stat --format='%g' /var/run/docker.sock)" --volume /var/run/docker.sock:/var/run/docker.sock --volume "<course-checkout>:/app/courses" ghcr.io/ivribalko/learn:latest
```

Open the production site:

```sh
open http://<media-server>:8000
```

Service boundaries, runtime state, request flows, and the Docker runner lifecycle are documented in [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Repository Instructions

- This app is a local-first course runner intended for trusted environments; do not add remote-user security features.
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
