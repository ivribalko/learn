#!/bin/sh

set -eu

COURSE_REQUIREMENTS=/app/courses/requirements.txt
COURSE_PACKAGES_ROOT=/opt/courses-requirements
COURSE_PACKAGES_DIR=$COURSE_PACKAGES_ROOT/site-packages
COURSE_PACKAGES_STAGING=$COURSE_PACKAGES_ROOT/site-packages.next
COURSE_PACKAGES_STAMP=$COURSE_PACKAGES_ROOT/requirements.sha256
PIP_CACHE_DIR=$COURSE_PACKAGES_ROOT/pip-cache


course_dependency_fingerprint() {
    {
        sha256sum "$COURSE_REQUIREMENTS"
        python -c 'import sys; print(sys.implementation.cache_tag)'
    } | sha256sum | cut -d ' ' -f 1
}


if [ -f "$COURSE_REQUIREMENTS" ]; then
    mkdir -p "$COURSE_PACKAGES_ROOT" "$PIP_CACHE_DIR"
    dependency_fingerprint=$(course_dependency_fingerprint)
    installed_fingerprint=
    if [ -f "$COURSE_PACKAGES_STAMP" ]; then
        installed_fingerprint=$(cat "$COURSE_PACKAGES_STAMP")
    fi

    if [ "$dependency_fingerprint" != "$installed_fingerprint" ] || [ ! -d "$COURSE_PACKAGES_DIR" ]; then
        rm -rf "$COURSE_PACKAGES_STAGING"
        python -m pip install \
            --disable-pip-version-check \
            --cache-dir "$PIP_CACHE_DIR" \
            --target "$COURSE_PACKAGES_STAGING" \
            -r "$COURSE_REQUIREMENTS"
        chmod -R a+rX "$COURSE_PACKAGES_STAGING"
        rm -rf "$COURSE_PACKAGES_DIR"
        mv "$COURSE_PACKAGES_STAGING" "$COURSE_PACKAGES_DIR"
        printf '%s\n' "$dependency_fingerprint" > "$COURSE_PACKAGES_STAMP"
    fi

    export PYTHONPATH="$COURSE_PACKAGES_DIR${PYTHONPATH:+:$PYTHONPATH}"
fi

python -m backend.course_state

export HOME=/home/learn
exec setpriv --reuid=1000 --regid=1000 --keep-groups "$@"
