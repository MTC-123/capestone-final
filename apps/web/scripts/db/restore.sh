#!/usr/bin/env bash
set -euo pipefail

# scripts/db/restore.sh — mongorestore an archive produced by backup.sh into
# a target database. Mirrors backup.sh's local-binary-then-docker fallback.
#
# Usage:
#   scripts/db/restore.sh <archive.gz> [target] [--drop]
#
# <target> is either:
#   - a full mongo URI (mongodb://... or mongodb+srv://...), or
#   - a bare database name, restored into the local dev replica set
#     (mongodb://localhost:27017/<name>?replicaSet=rs0&directConnection=true)
#   - omitted, in which case $DATABASE_URL is used
#
# --drop makes mongorestore drop each collection before restoring into it —
# use it whenever the target database might already have data (including
# the local dev DB you likely just backed up from).
#
# The archive records its source database name in each namespace
# (<db>.<collection>) — restoring into a *different* database name (e.g.
# ricer -> ricer_restore_test for a rehearsal) needs an explicit remap via
# --nsFrom/--nsTo. SOURCE_DB (default "ricer") controls the source side of
# that remap; override it if you ever back up a differently-named database.
#
# Examples:
#   scripts/db/restore.sh backups/ricer-backup-20260924T101500Z.gz ricer_restore_test --drop
#   scripts/db/restore.sh backups/ricer-backup-....gz "mongodb+srv://user:pass@cluster/ricer" --drop

CONTAINER="${MONGO_CONTAINER:-ricer-mongo}"
SOURCE_DB="${SOURCE_DB:-ricer}"

ARCHIVE="${1:-}"
if [[ -z "$ARCHIVE" || ! -f "$ARCHIVE" ]]; then
  echo "error: archive file not found: ${ARCHIVE:-<none>}" >&2
  echo "usage: $0 <archive.gz> [target-uri-or-db-name] [--drop]" >&2
  exit 1
fi
ARCHIVE="$(cd "$(dirname "$ARCHIVE")" && pwd)/$(basename "$ARCHIVE")"
shift || true

TARGET=""
DROP_FLAG=""
for arg in "$@"; do
  case "$arg" in
    --drop) DROP_FLAG="--drop" ;;
    *) TARGET="$arg" ;;
  esac
done
TARGET="${TARGET:-${DATABASE_URL:-}}"
if [[ -z "$TARGET" ]]; then
  echo "error: no target given and DATABASE_URL is not set" >&2
  exit 1
fi

if [[ "$TARGET" == mongodb://* || "$TARGET" == mongodb+srv://* ]]; then
  FULL_URI="$TARGET"
else
  FULL_URI="mongodb://localhost:27017/${TARGET}?replicaSet=rs0&directConnection=true"
fi

# Pull the database name out of the URI path, then strip it back off: with
# --archive, a db name embedded in --uri makes mongorestore implicitly
# filter namespaces to that db *before* applying --nsFrom/--nsTo, which
# drops everything when source and target db names differ. Passing a
# db-less connection URI and doing the rename purely through --nsFrom/--nsTo
# avoids that (verified against this project's own archives).
TARGET_DB="$(echo "$FULL_URI" | sed -E 's#^mongodb(\+srv)?://[^/]+/([^/?]+).*#\2#')"
if [[ "$TARGET_DB" == "$FULL_URI" || -z "$TARGET_DB" ]]; then
  echo "error: could not determine a target database name from: $TARGET" >&2
  exit 1
fi
CONNECTION_URI="$(echo "$FULL_URI" | sed -E 's#^(mongodb(\+srv)?://[^/]+)/[^?]*(\??.*)#\1/\3#')"

redact() { echo "$1" | sed -E 's#(mongodb(\+srv)?://)[^:@]+:[^@]+@#\1***:***@#'; }

echo "Restoring:  $ARCHIVE"
echo "Source db:  $SOURCE_DB"
echo "Target:     $(redact "$CONNECTION_URI") (db: $TARGET_DB)"
[[ -n "$DROP_FLAG" ]] && echo "Mode:       --drop (existing collections in the target are dropped first)"

NS_ARGS=(--nsFrom="${SOURCE_DB}.*" --nsTo="${TARGET_DB}.*")

if command -v mongorestore >/dev/null 2>&1; then
  echo "Using local mongorestore..."
  mongorestore --uri="$CONNECTION_URI" --gzip --archive="$ARCHIVE" "${NS_ARGS[@]}" $DROP_FLAG
elif docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$CONTAINER"; then
  echo "Local mongorestore not found — using 'docker exec $CONTAINER mongorestore'..."
  REMOTE_PATH="/tmp/$(basename "$ARCHIVE")"
  docker cp "$ARCHIVE" "$CONTAINER:$REMOTE_PATH"
  docker exec "$CONTAINER" mongorestore --uri="$CONNECTION_URI" --gzip --archive="$REMOTE_PATH" "${NS_ARGS[@]}" $DROP_FLAG
  docker exec "$CONTAINER" rm -f "$REMOTE_PATH"
else
  echo "error: mongorestore is not installed locally and no running docker container named '$CONTAINER' was found." >&2
  exit 1
fi

echo "Restore complete."
