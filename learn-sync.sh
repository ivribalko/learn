#!/bin/sh

set -eu

COURSES_DIR=/courses
SYNC_DIR=/sync
REQUESTS_DIR=$SYNC_DIR/requests
READY_FILE=$SYNC_DIR/ready
POLL_SECONDS=${COURSES_SYNC_POLL_SECONDS:-2}
RECOVERY_COMMIT_MESSAGE=${COURSES_RECOVERY_COMMIT_MESSAGE:-saved recovered checkout}


configure_git() {
    git config --global --add safe.directory "$COURSES_DIR"
    git config --global user.name "${COURSES_GIT_AUTHOR_NAME:-Learn Course Sync}"
    git config --global user.email "${COURSES_GIT_AUTHOR_EMAIL:-learn-course-sync@users.noreply.github.com}"

    auth=$(printf 'x-access-token:%s' "$GITHUB_TOKEN" | base64 | tr -d '\n')
    git config --global \
        http.https://github.com/.extraheader \
        "Authorization: Basic $auth"
}


sync_courses() {
    commit_message=$1
    git -C "$COURSES_DIR" add --all || return 1
    if ! git -C "$COURSES_DIR" diff --cached --quiet; then
        git -C "$COURSES_DIR" commit --message "$commit_message" || return 1
    fi

    git -C "$COURSES_DIR" fetch --prune origin main || return 1
    if ! git -C "$COURSES_DIR" rebase origin/main; then
        git -C "$COURSES_DIR" rebase --abort >/dev/null 2>&1 || true
        return 1
    fi

    if [ "$(git -C "$COURSES_DIR" rev-list --count origin/main..HEAD)" -eq 0 ]; then
        return 0
    fi

    git -C "$COURSES_DIR" push origin HEAD:main || return 1
}


prepare_checkout() {
    repository_url=${COURSES_REPOSITORY_URL:-https://github.com/${COURSES_REPOSITORY}.git}
    if [ -d "$COURSES_DIR/.git" ]; then
        git -C "$COURSES_DIR" remote set-url origin "$repository_url"
        current_branch=$(git -C "$COURSES_DIR" branch --show-current)
        if [ "$current_branch" != main ]; then
            git -C "$COURSES_DIR" checkout main
        fi
    else
        git clone \
            --branch main \
            --single-branch \
            "$repository_url" \
            "$COURSES_DIR"
    fi

    sync_courses "$RECOVERY_COMMIT_MESSAGE"
}


next_request() {
    for request in "$REQUESTS_DIR"/*; do
        if [ -f "$request" ]; then
            printf '%s\n' "$request"
            return 0
        fi
    done
    return 1
}


mkdir -p "$REQUESTS_DIR"
chmod 1777 "$REQUESTS_DIR"
rm -f "$READY_FILE"
configure_git
prepare_checkout
touch "$READY_FILE"

while :; do
    if request=$(next_request); then
        course_id=$(sed -n '1p' "$request")
        lesson_id=$(sed -n '2p' "$request")
        if [ -z "$course_id" ] || [ -z "$lesson_id" ]; then
            commit_message=$RECOVERY_COMMIT_MESSAGE
        else
            commit_message="saved $course_id $lesson_id"
        fi
        if sync_courses "$commit_message"; then
            rm -f "$request"
        fi
    fi
    sleep "$POLL_SECONDS"
done
