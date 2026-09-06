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
# Install (as the ensemble user). The mkdir is NOT optional and must come
# before the crontab line: cron's redirect is opened by the shell BEFORE this
# script runs, so if backups/ doesn't exist yet the redirect fails, the script
# never executes, and because the failure is in the redirect there is no log to
# notice it in.
#
#   chmod +x /srv/ensemble/scripts/backup.sh
#   mkdir -p /srv/ensemble/backups
#   crontab -e
#   0 4 * * * /srv/ensemble/scripts/backup.sh >> /srv/ensemble/backups/backup.log 2>&1
#
# Restore is documented in DEPLOY.md §8.

set -euo pipefail

APP_DIR="${APP_DIR:-/srv/ensemble}"
DATA_DIR="$APP_DIR/data"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"

# cron does not source .env, so anything documented as "add it to .env" is
# simply absent here — which is why off-droplet copies had never been made
# despite BACKUP_REMOTE being set exactly where the runbook said to set it.
# Reading it explicitly is what makes that instruction true.
if [ -f "$APP_DIR/.env" ]; then
  # shellcheck disable=SC1090
  set -a; . "$APP_DIR/.env"; set +a
fi

# sqlite3 is what lines below and the entire documented restore depend on, and
# §3 of the runbook never installed it. Under `set -euo pipefail` the job died
# on the first .backup every night.
if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "✗ sqlite3 is not installed. Run: sudo apt install -y sqlite3" >&2
  exit 1
fi
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
# Written to a temporary name first. "Keeping yesterday's" was not what the old
# code did: STAMP is the day of week, so the .backup had ALREADY overwritten
# last week's copy for this slot, and the rm on failure then deleted that too —
# leaving nothing at all for this day.
DB_TMP="$DB_OUT.partial"
echo "→ database  $DB_OUT"
rm -f "$DB_TMP"
sqlite3 "$DATA_DIR/app.db" ".backup '$DB_TMP'"

# Integrity-check the copy, not the original. A backup nobody has opened is a
# guess, and this is the one moment the copy is cheap to verify.
if ! sqlite3 "$DB_TMP" "PRAGMA integrity_check;" | grep -qx "ok"; then
  echo "✗ Backup failed its integrity check — keeping the previous one and stopping." >&2
  rm -f "$DB_TMP" "$DB_TMP-wal" "$DB_TMP-shm"
  exit 1
fi

# Fold any WAL back into the file and leave WAL mode, so the archive really is
# the single self-contained file this script's header promises. Opening the
# copy (above) recreates -wal/-shm beside it, and shipping a database whose
# sidecars have been left behind is how a restore quietly loses recent writes.
sqlite3 "$DB_TMP" "PRAGMA journal_mode=DELETE;" >/dev/null
rm -f "$DB_TMP-wal" "$DB_TMP-shm"

# Only now does it replace the slot.
mv -f "$DB_TMP" "$DB_OUT"


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

# NOTE: these archives carry plaintext OAuth access and refresh tokens for
# every connected social account, creators' own Stripe and email-platform API
# keys, and their RTMP stream keys. Anywhere they are copied to inherits all of
# that, so the remote wants to be private and encrypted at rest — rclone's
# `crypt` remote is the least-effort way to get that, and BACKUP_REMOTE can
# point at one without changing anything here.
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
