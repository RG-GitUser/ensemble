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

# Fetch and decode separately, so "the app is down" is distinguishable from
# "this creator saved no stream keys". Previously a failed curl produced empty
# output and took the no-targets branch, which sleeps for an hour — leaving the
# on-air badge lit while nothing was being pushed anywhere.
if ! RAW=$(curl -fsS -m 10 "$APP/api/live/targets?key=$KEY" -H "x-live-secret: $SECRET"); then
  log "couldn't reach the app to ask where to push — staying up, pushing nowhere"
  while sleep 60; do :; done
fi

# Count first, then stream the targets in NUL-delimited.
#
# Stream keys are validated server-side, but this side must not depend on that.
# `jq -r` prints an embedded newline as a real one, and this loop used to read
# line by line — so a key containing "\nfile:/srv/ensemble/data/uploads/x.bin"
# added a SECOND ffmpeg output writing wherever the service user can write, on
# the same disk as every tenant's database. Every expansion here was already
# correctly quoted, so this was never shell injection; it was line injection
# into the argument list, which was enough.
#
# The NUL stream is piped STRAIGHT into the loop rather than through a
# variable: command substitution strips NUL bytes, which would silently throw
# every target away.
TARGET_COUNT=$(printf '%s' "$RAW" | jq '.targets | length')

if [ "${TARGET_COUNT:-0}" -eq 0 ]; then
  log "no stream keys saved — ingesting but pushing nowhere"
  # Stay alive so the on-air badge still works; cleanup runs on stream end.
  while sleep 3600; do :; done
fi

count=0
while IFS= read -r -d '' url; do
  [ -z "$url" ] && continue
  count=$((count + 1))
  # -c copy: pure forwarding, no transcode — this is what keeps the relay
  # cheap enough to live beside the app.
  #
  # Egress is NOT accounted per creator anywhere. scripts/check-egress.sh
  # watches the whole droplet with vnstat and warns once the month is heading
  # somewhere bad, which catches the bill but cannot attribute it, cannot stop
  # it, and cannot tell one heavy streamer from ten light ones. At roughly
  # 8 GB/hour to three destinations, one continuous streamer clears a 1 TB
  # allowance in about five days. A per-site quota needs byte accounting that
  # does not exist yet — see the launch notes before selling this at volume.
  #
  # -nostdin: without it every ffmpeg child shares this script's stdin and
  # they fight over it. It also removes the interactive overwrite prompt as
  # the only thing standing between a file: destination and a clobbered file.
  ffmpeg -nostdin -hide_banner -loglevel error \
    -i "rtmp://127.0.0.1:1935/$MTX_PATH" \
    -c copy -f flv "$url" &
done < <(printf '%s' "$RAW" | jq -j '.targets[] | .url, "\u0000"')

log "pushing to $count destination(s)"

# One push dying (bad key, platform hiccup) must not stop the others, so wait
# on all of them rather than exiting with the first.
wait
cleanup
