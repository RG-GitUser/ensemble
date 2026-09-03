#!/usr/bin/env bash
#
# Nightly backup of everything mutable: the SQLite database and the uploads.
#
# Two things this fixes over the one-liner it replaces
# (`sqlite3 data/app.db ".backup data/backup-$(date +%u).db"`):
#
#   1. That wrote its snapshots into data/ — the very directory it was backing
#      up. The copies shared a disk with the original, so a lost droplet lost
#      the backups with it, and each night's file was swept into the next
#      night's droplet snapshot. Backups now live outside data/ entirely.
#   2. It covered the database and nothing else. Uploads — every portrait,
#      background and favicon a creator has added — sat in data/uploads with no
#      backup at all.
#
# `sqlite3 .backup` is used rather than `cp` because the database runs in WAL
# mode: at any moment most of the recent writes are in app.db-wal, and copying
# app.db alone captures an almost empty database. `.backup` reads through the
# WAL and produces a consistent single file.
#
# Off-droplet copying is the part that actually survives losing the machine. It
# is opt-in: set BACKUP_REMOTE to an rclone remote (e.g. "spaces:ensemble-backups")
# and the day's archive is pushed there too. Without it the script still runs,
# and says plainly that the copies are local-only.
#
# Install (as the ensemble user):
#   chmod +x /srv/ensemble/scripts/backup.sh
#   crontab -e
#   0 4 * * * /srv/ensemble/scripts/backup.sh >> /srv/ensemble/backups/backup.log 2>&1
#
# Restore is documented in DEPLOY.md §8.

set -euo pipefail

APP_DIR="${APP_DIR:-/srv/ensemble}"

# DEPLOY.md documents BACKUP_REMOTE as a line appended to .env, but cron runs
# this with a bare environment and never sources it — so off-droplet copies
# silently never happened. Read it here, where the documentation says it lives.
if [ -f "$APP_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$APP_DIR/.env"
  set +a
fi
DATA_DIR="$APP_DIR/data"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
# Day of week (1-7), so the set self-prunes to a rolling week without needing
# a delete pass. Change to +%F for dated files, and add a find -mtime prune.
STAMP="$(date +%u)"
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DATA_DIR/app.db" ]; then
  echo "✗ No database at $DATA_DIR/app.db — wrong APP_DIR?" >&2
  exit 1
fi

DB_OUT="$BACKUP_DIR/app-$STAMP.db"
echo "→ database  $DB_OUT"
sqlite3 "$DATA_DIR/app.db" ".backup '$DB_OUT'"

# Integrity-check the copy, not the original. A backup nobody has opened is a
# guess, and this is the one moment the copy is cheap to verify.
if ! sqlite3 "$DB_OUT" "PRAGMA integrity_check;" | grep -qx "ok"; then
  # NOT rm: $STAMP is the weekday, so .backup has already overwritten last
  # week's copy in this slot. Deleting it here emptied the slot entirely, and
  # seven consecutive failures emptied every slot — while the message claimed
  # yesterday's was being kept. Park it for diagnosis instead.
  mv -f "$DB_OUT" "$DB_OUT.bad" 2>/dev/null || true
  echo "✗ Backup failed its integrity check — kept as $DB_OUT.bad. THIS SLOT HAS NO GOOD BACKUP." >&2
  exit 1
fi

if [ -d "$DATA_DIR/uploads" ]; then
  UP_OUT="$BACKUP_DIR/uploads-$STAMP.tar.gz"
  echo "→ uploads   $UP_OUT"
  tar czf "$UP_OUT" -C "$DATA_DIR" uploads
else
  echo "· no uploads directory yet, skipping"
fi

# Anything older than KEEP_DAYS is past the rotation and only taking up disk.
find "$BACKUP_DIR" -maxdepth 1 -name 'app-*.db' -mtime "+$KEEP_DAYS" -delete
find "$BACKUP_DIR" -maxdepth 1 -name 'uploads-*.tar.gz' -mtime "+$KEEP_DAYS" -delete

if [ -n "${BACKUP_REMOTE:-}" ]; then
  if command -v rclone >/dev/null 2>&1; then
    echo "→ off-droplet  $BACKUP_REMOTE"
    rclone copy "$BACKUP_DIR" "$BACKUP_REMOTE" --include 'app-*.db' --include 'uploads-*.tar.gz'
  else
    echo "✗ BACKUP_REMOTE is set but rclone is not installed — copies are local only." >&2
    exit 1
  fi
else
  echo "· BACKUP_REMOTE unset — copies are on this droplet only, so they do not"
  echo "  survive losing it. See DEPLOY.md §8 to send them off-box."
fi

echo "✓ $(date +%Y-%m-%dT%H:%M:%S%z)"
