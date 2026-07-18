#!/bin/sh

set -eu

if [ -f /app/courses/requirements.txt ]; then
    python -m pip install --disable-pip-version-check --no-cache-dir -r /app/courses/requirements.txt
fi

python -m backend.course_state

export HOME=/home/learn
exec setpriv --reuid=1000 --regid=1000 --keep-groups "$@"
