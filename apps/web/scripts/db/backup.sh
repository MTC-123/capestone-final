#!/usr/bin/env bash
set -euo pipefail

# scripts/db/backup.sh — mongodump a RICER Mongo database into a timestamped
# gzip archive under backups/.
#
# Works two ways:
#   1. If `mongodump` is installed locally, it's used directly against the URI.
#   2. Otherwise, falls back to `docker exec ricer-mongo mongodump` — the
#      container ships the MongoDB Database Tools, and works equally well
#      against the local replica set or a remote (e.g. Atlas) URI, since the
#      container just needs outbound network access to reach it.
#
# This is the backup strategy for the Atlas M0 demo tier, which has no
# server-side snapshots — see docs/runbooks/backup-restore.md.
#
# Usage:
#   scripts/db/backup.sh                        # backs up $DATABASE_URL
#   scripts/db/backup.sh "mongodb+srv://..."     # backs up an explicit URI
#   BACKUP_DIR=/some/path scripts/db/backup.sh   # custom output directory
#   MONGO_CONTAINER=my-mongo scripts/db/backup.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

URI="${1:-${DATABASE_URL:-}}"
if [[ -z "$URI" ]]; then
  echo "error: no URI given and DATABASE_URL is not set" >&2
  echo "usage: $0 [mongo-uri]" >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-$WEB_DIR/backups}"
mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE_PATH="$BACKUP_DIR/ricer-backup-${TIMESTAMP}.gz"
CONTAINER="${MONGO_CONTAINER:-ricer-mongo}"

redact() { echo "$1" | sed -E 's#(mongodb(\+srv)?://)[^:@]+:[^@]+@#\1***:***@#'; }

echo "Backing up: $(redact "$URI")"
echo "Output:     $ARCHIVE_PATH"

if command -v mongodump >/dev/null 2>&1; then
  echo "Using local mongodump..."
  mongodump --uri="$URI" --gzip --archive="$ARCHIVE_PATH"
elif docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$CONTAINER"; then
  echo "Local mongodump not found — using 'docker exec $CONTAINER mongodump'..."
  REMOTE_PATH="/tmp/ricer-backup-${TIMESTAMP}.gz"
  docker exec "$CONTAINER" mongodump --uri="$URI" --gzip --archive="$REMOTE_PATH"
  docker cp "$CONTAINER:$REMOTE_PATH" "$ARCHIVE_PATH"
  docker exec "$CONTAINER" rm -f "$REMOTE_PATH"
else
  echo "error: mongodump is not installed locally and no running docker container named '$CONTAINER' was found." >&2
  echo "Install the MongoDB Database Tools, or start the local dev container." >&2
  exit 1
fi

if [[ ! -s "$ARCHIVE_PATH" ]]; then
  echo "error: backup archive was not created or is empty: $ARCHIVE_PATH" >&2
  exit 1
fi

SIZE="$(du -h "$ARCHIVE_PATH" | cut -f1)"
echo "Backup complete: $ARCHIVE_PATH ($SIZE)"
