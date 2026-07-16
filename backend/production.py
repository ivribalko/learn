"""Production application that serves the built frontend and shared API."""

from pathlib import Path

from starlette.exceptions import HTTPException
from starlette.responses import Response
from starlette.staticfiles import StaticFiles

from backend.app import app
from backend.course_paths import PROJECT_ROOT


FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"


class SinglePageApplication(StaticFiles):
    """Serves built assets and falls back to the frontend entry document."""

    async def get_response(self, path: str, scope: dict[str, object]) -> Response:
        """Returns an asset, an API 404, or the entry document for a client route."""

        if path == "api" or path.startswith("api/"):
            raise HTTPException(status_code=404)
        try:
            response = await super().get_response(path, scope)
        except HTTPException as error:
            if error.status_code != 404:
                raise
            return await super().get_response("index.html", scope)
        if response.status_code == 404:
            return await super().get_response("index.html", scope)
        return response


def _mount_frontend(frontend_dist: Path) -> None:
    """Mounts the production frontend after all API routes."""

    if not (frontend_dist / "index.html").is_file():
        raise RuntimeError("The production frontend build is missing.")
    app.mount("/", SinglePageApplication(directory=frontend_dist, html=True), name="frontend")


_mount_frontend(FRONTEND_DIST)
