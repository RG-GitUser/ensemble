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

TARGETS=$(curl -fsS -m 10 "$APP/api/live/targets?key=$KEY" -H "x-live-secret: $SECRET" | jq -r '.targets[].url')

if [ -z "$TARGETS" ]; then
  log "no stream keys saved — ingesting but pushing nowhere"
  # Stay alive so the on-air badge still works; cleanup runs on stream end.
  while sleep 3600; do :; done
fi

count=0
while IFS= read -r url; do
  [ -z "$url" ] && continue
  count=$((count + 1))
  # -c copy: pure forwarding, no transcode — this is what keeps the relay
  # cheap enough to live beside the app. Egress is logged per push below.
  ffmpeg -hide_banner -loglevel error \
    -i "rtmp://127.0.0.1:1935/$MTX_PATH" \
    -c copy -f flv "$url" &
done <<< "$TARGETS"

log "pushing to $count destination(s)"

# One push dying (bad key, platform hiccup) must not stop the others, so wait
# on all of them rather than exiting with the first.
wait
cleanup
