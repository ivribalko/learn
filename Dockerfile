FROM node:24-bookworm-slim AS frontend-build

WORKDIR /build/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


FROM docker:cli AS docker-cli


FROM python:3.14-slim-bookworm AS runtime

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker

RUN useradd --create-home --uid 1000 learn

WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN python -m venv .venv \
    && .venv/bin/python -m pip install --disable-pip-version-check --no-cache-dir -r backend/requirements.txt

COPY backend/ backend/
COPY docker-entrypoint.sh /usr/local/bin/learn-entrypoint
COPY --from=frontend-build /build/frontend/dist/ frontend/dist/

RUN mkdir courses \
    && chmod +x /usr/local/bin/learn-entrypoint \
    && chown -R learn:learn /app

VOLUME ["/app/courses"]
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3)"]

ENTRYPOINT ["learn-entrypoint"]
CMD ["uvicorn", "backend.production:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
