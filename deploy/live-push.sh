#!/usr/bin/env bash
# Ensemble live relay — per-stream fan-out.
#
# MediaMTX starts this when a stream begins (pathDefaults.runOnReady) and
# SIGTERMs it when the stream ends. It tells the app the site is live, asks
# where to push, runs one copy-mode ffmpeg per destination, and marks the
# site offline again on the way out.
#
# Needs: curl, jq, ffmpeg. Env: MTX_PATH (from MediaMTX), LIVE_HOOK_SECRET
# (from the systemd unit's EnvironmentFile).

set -u

APP="http://127.0.0.1:3000"
KEY="${MTX_PATH#live/}"
SECRET="${LIVE_HOOK_SECRET:?LIVE_HOOK_SECRET missing — check mediamtx.service EnvironmentFile}"

log() { echo "[live-push ${KEY:0:6}…] $*"; }

notify() {
  curl -fsS -m 10 -X POST "$APP/api/live/status" \
    -H "x-live-secret: $SECRET" -H "Content-Type: application/json" \
    -d "{\"key\":\"$KEY\",\"live\":$1}" >/dev/null || log "status notify ($1) failed"
}

cleanup() {
  trap - TERM INT EXIT
  notify false
  # Take the ffmpeg children down with us; stray pushes would keep the
  # platform "live" with a frozen frame after the creator stopped.
  pkill -P $$ 2>/dev/null
  wait 2>/dev/null
  log "stream ended"
  exit 0
}
trap cleanup TERM INT EXIT

notify true

# One base64 word per destination. The URLs carry creator-supplied stream keys,
# and plain `jq -r` prints an embedded newline as a real one — so a key with a
# newline in it used to split into an extra line here and become an extra ffmpeg
# destination, with a target the creator chose. Base64 has no newlines, so a
# line is always exactly one destination. (A NUL delimiter would be the other
# idiom, but bash cannot hold NUL bytes in a variable.) The app validates keys
# too; this is the half that cannot be bypassed by a value stored before it did.
#
# The lookup's exit status is captured separately: an empty result because the
# app is restarting is not the same thing as a creator with no keys saved, and
# taking the no-keys branch for it left the on-air badge lit while nothing was
# pushed anywhere.
TARGETS=$(curl -fsS -m 10 "$APP/api/live/targets?key=$KEY" -H "x-live-secret: $SECRET" | jq -r '.targets[].url | @base64')
LOOKUP_STATUS=$?

if [ "$LOOKUP_STATUS" -ne 0 ]; then
  log "could not reach $APP to look up stream keys (status $LOOKUP_STATUS) — pushing nowhere"
  while sleep 30; do :; done
fi

if [ -z "$TARGETS" ]; then
  log "no stream keys saved — ingesting but pushing nowhere"
  # Stay alive so the on-air badge still works; cleanup runs on stream end.
  # Short sleeps rather than one long one: bash runs a trap only between
  # foreground commands, so `sleep 3600` deferred cleanup — and the on-air
  # badge with it — for up to an hour after the stream ended.
  while sleep 30; do :; done
fi

count=0
while IFS= read -r encoded; do
  [ -z "$encoded" ] && continue
  url=$(printf '%s' "$encoded" | base64 -d)
  [ -z "$url" ] && continue
  count=$((count + 1))
  # -c copy: pure forwarding, no transcode — this is what keeps the relay
  # cheap enough to live beside the app. Egress is logged per push below.
  ffmpeg -hide_banner -loglevel error \
    -i "rtmp://127.0.0.1:1935/$MTX_PATH" \
    -c copy -f flv -nostdin "$url" &
done <<< "$TARGETS"

log "pushing to $count destination(s)"

# One push dying (bad key, platform hiccup) must not stop the others, so wait
# on all of them rather than exiting with the first.
wait
cleanup
