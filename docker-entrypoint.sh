#!/bin/sh

set -eu

mkdir -p /app/courses/var
chown -R 1000:1000 /app/courses/var

if [ -f /app/courses/requirements.txt ]; then
    python -m pip install --disable-pip-version-check --no-cache-dir -r /app/courses/requirements.txt
fi

export HOME=/home/learn
exec setpriv --reuid=1000 --regid=1000 --keep-groups "$@"
