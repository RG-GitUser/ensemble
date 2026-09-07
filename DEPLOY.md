# Deploying Ensemble to a DigitalOcean droplet

Platform domain: **ensemble.it.com**. One droplet runs everything: Caddy
(TLS + reverse proxy, including automatic certificates for creators' custom
domains) in front of the Next.js app with its SQLite database.

## 1. Droplet + IP

- Ubuntu 24.04 LTS droplet. **2GB RAM minimum** (`next build` OOMs on 1GB —
  or add swap, step 4).
- Add a **Reserved IP** to the droplet (Networking → Reserved IPs). This is
  the address creators point their A records at — it must survive rebuilds.

## 2. DNS (at the it.com registrar)

| Type | Host | Value |
|------|------|-------|
| A | `ensemble.it.com` | reserved IP |
| A or CNAME | `www` | reserved IP / `ensemble.it.com` |
| A | `sites` | reserved IP |

`sites.ensemble.it.com` is the CNAME target creators use for subdomains
(`DOMAIN_CNAME_TARGET`).

## 3. Server basics

```sh
adduser ensemble
# NOT in sudo. This account runs the service; the whole point of a service
# account is that compromising the app is not the same as owning the box.
# Administer as root or from your own sudo-capable login.
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable

# Node 22 LTS + build tools (better-sqlite3 compiles natively)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
# sqlite3 is NOT optional: scripts/backup.sh and the entire documented restore
# in §8 shell out to it. Leaving it out meant the nightly backup died on its
# first command every night, under `set -euo pipefail`, silently.
apt-get install -y nodejs build-essential python3 sqlite3

# Caddy (official repo)
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update && apt-get install -y caddy
```

## 4. (1GB droplets only) swap

```sh
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## 5. The app

`/srv` is root-owned, so the directory has to exist and belong to `ensemble`
before the clone — `sudo -iu ensemble; git clone … /srv/ensemble` on its own
fails with permission denied.

```sh
# as root
mkdir -p /srv/ensemble && chown ensemble:ensemble /srv/ensemble

sudo -iu ensemble
git clone <your-repo> /srv/ensemble   # or rsync the project up
cd /srv/ensemble
cp .env.example .env                  # then EDIT IT:
#  - DOMAIN_A_RECORD = the reserved IP
#  - APP_URL         = the public origin (Checkout returns here)
#  - PLATFORM_HOSTS  = every hostname Caddy routes to the app

# Every secret lives in this file. Default umask leaves it world-readable.
chmod 600 .env

mkdir -p backups                      # §8's cron redirect opens this BEFORE
                                      # the script runs — without it the job
                                      # never executes and leaves no log

npm ci
npm run build
```

**Leave `ADMIN_PASSWORD` commented out.** The admin account is seeded on the
first start and env changes do nothing afterwards, so this is one-shot and
permanent. With the line unset, a random password is generated and printed once
to the log; with it set to the placeholder that used to ship in
`.env.example`, the admin account is seeded — in a public repo — with a
password published in that same repo.

After the first start (§6), read it out of the log and store it:

```sh
journalctl -u ensemble | grep 'Admin seeded with'
```

Then rotate it deliberately:

```sh
cd /srv/ensemble && read -rs NEWPW && printf '%s' "$NEWPW" | node scripts/set-admin-password.mjs
```

## 6. Services

```sh
# as root
cp /srv/ensemble/deploy/ensemble.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now ensemble

cp /srv/ensemble/deploy/Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy
```

## 7. Smoke test

```sh
curl -I https://ensemble.it.com                              # 200, valid cert
curl -s https://ensemble.it.com/api/health                   # {"status":"ok"}
curl -s http://localhost:3000/api/domains/check?domain=x.com # 404 (unknown domain)
curl -sI https://ensemble.it.com/api/domains/check           # 403 (blocked at the edge)
```

### Monitoring

Point an uptime check (UptimeRobot, Better Stack, whatever wakes a phone) at
`https://ensemble.it.com/api/health` on a 1–5 minute interval. It touches the
database, so it distinguishes "up" from "up and returning 500 to everyone" —
which nothing outside the box could previously tell.

`ensemble.service` now sets `StartLimitIntervalSec`/`StartLimitBurst`, so a
crash loop stops after five failures in five minutes instead of restarting
silently forever. That only helps if something is watching:

```sh
systemctl status ensemble       # "failed" rather than endlessly "activating"
journalctl -u ensemble -n 50
tail -f /var/log/caddy/access.log
```

Caddy access logs are on (`deploy/Caddyfile`), rotating at 50 MiB and kept for
30 days. Create the directory once: `mkdir -p /var/log/caddy && chown caddy:caddy /var/log/caddy`.

Then in the dashboard: Settings → connect a custom domain you control, add
its A record → the first HTTPS visit mints its certificate automatically.

## 8. Backups

Everything mutable lives in `/srv/ensemble/data/` (SQLite DB + uploads).

```sh
chmod +x /srv/ensemble/scripts/backup.sh
mkdir -p /srv/ensemble/backups   # MUST exist first — see below
crontab -e   # as the ensemble user
0 4 * * * /srv/ensemble/scripts/backup.sh >> /srv/ensemble/backups/backup.log 2>&1
```

The `mkdir` is load-bearing and has to happen before the crontab line. The
redirect is opened by cron's shell **before** the script runs, so on a fresh
droplet — where `backups/` is created by the script itself — opening the log
failed, the script never executed, and because the failure was in the redirect
there was no log to notice it in.

`scripts/backup.sh` writes to `/srv/ensemble/backups/` — deliberately outside
`data/`. It snapshots the database with `sqlite3 .backup`, tars the uploads,
integrity-checks the copy before keeping it, and prunes past `KEEP_DAYS`.

**Use `.backup`, never `cp`.** The database runs in WAL mode, so at any moment
most recent writes are in `app.db-wal` rather than `app.db`. Copying `app.db`
alone gets you an almost empty database that still opens cleanly — the worst
kind of bad backup. Any manual copy must take `app.db`, `app.db-wal` and
`app.db-shm` together.

### Off the droplet

Local copies do not survive losing the droplet, which is most of what a backup
is for. Set an [rclone](https://rclone.org) remote (DigitalOcean Spaces is
S3-compatible) and the script pushes each night's files there too:

```sh
apt install -y rclone

# As the SERVICE user, not root. The cron job runs as `ensemble`, and rclone
# reads its config from the running user's home — a remote configured as root
# is invisible to the job that needs it.
sudo -iu ensemble rclone config    # add a remote, e.g. "spaces"

echo 'BACKUP_REMOTE=spaces:ensemble-backups' >> /srv/ensemble/.env
```

`BACKUP_REMOTE` goes in `.env` and the script now sources that file itself.
That matters: **cron does not source `.env`**, so a variable documented as
"add it to .env" was simply absent from the job's environment, and off-droplet
copies were never made despite the setting being exactly where this page said
to put it.

These archives carry plaintext OAuth tokens, creators' own Stripe and email
API keys, and their stream keys. Point `BACKUP_REMOTE` at an rclone `crypt`
remote so they are encrypted at rest, or accept that the bucket is as sensitive
as the droplet.

Without `BACKUP_REMOTE` the script still runs and says the copies are local
only. DigitalOcean droplet snapshots (weekly) cover the rest of the disk.

Verify it actually ran, the morning after:

```sh
tail -20 /srv/ensemble/backups/backup.log
ls -la /srv/ensemble/backups/
```

### Restoring

```sh
systemctl stop ensemble

cd /srv/ensemble/data
# Move the broken database aside WITH its WAL — the recent writes are in there,
# and they are exactly what you would want if the backup turns out to be older
# than you hoped. (The previous version of this page said to keep app.db
# "because it may still have the WAL" and then deleted the WAL on the next
# line, which threw away the thing it was keeping it for.)
mkdir -p ../broken-$(date +%F)
mv app.db app.db-wal app.db-shm ../broken-$(date +%F)/ 2>/dev/null

cp /srv/ensemble/backups/app-3.db app.db   # pick the day you want
tar xzf /srv/ensemble/backups/uploads-3.tar.gz -C /srv/ensemble/data

chown -R ensemble:ensemble /srv/ensemble/data
sqlite3 app.db "PRAGMA integrity_check;"   # expect: ok
systemctl start ensemble
curl -fsS https://ensemble.it.com/api/health   # expect: {"status":"ok"}
```

There must be no `-wal`/`-shm` sitting beside the restored file: SQLite would
replay a leftover WAL against a database it does not belong to. Moving all
three aside together gets that right and keeps the originals.

**Rehearse this before launch, and once a quarter after.** Restore onto a
throwaway droplet, start the app, sign in. An untested backup is a belief, not
a backup — and this is the one procedure nobody wants to be reading for the
first time at 3am.

## 9. Updating the app

```sh
# as root — the repo is owned by the ensemble user, and building as root
# leaves root-owned .next/ and node_modules/ the service cannot write to.
sudo -iu ensemble bash -lc 'cd /srv/ensemble && git pull && npm ci && npm run build'
systemctl restart ensemble
curl -fsS https://ensemble.it.com/api/health   # expect: {"status":"ok"}
```

**This has no rollback, and that is a real risk on a small droplet.** `npm ci`
deletes `node_modules/` before it starts and `next build` overwrites `.next/`,
on a box §4 says may need swap to build at all — so a build that OOMs halfway
leaves no working previous version to fall back to.

Take a snapshot first, always:

```sh
sudo -iu ensemble bash -lc 'cd /srv/ensemble && cp -a .next ../next-prev && git rev-parse HEAD > ../deployed-sha'
```

and if the new build fails or misbehaves:

```sh
sudo -iu ensemble bash -lc 'cd /srv/ensemble && git checkout $(cat ../deployed-sha) && rm -rf .next && cp -a ../next-prev .next'
systemctl restart ensemble
```

The durable fix is to build into a timestamped directory behind a `current`
symlink, so a restart is atomic and a rollback is a symlink swap. Worth doing
before the customer count makes a failed deploy expensive.

## 10. Live relay (optional — switches on simulcasting)

Creators stream once to the droplet and MediaMTX + ffmpeg push it to every
platform they saved a stream key for. Skippable: without it, everything else
runs and the dashboard shows the "simulcasting is nearly here" state.

```sh
# as root — the relay's tools
apt install -y ffmpeg jq
MTX_V=v1.9.3   # check github.com/bluenviron/mediamtx/releases for current
curl -fL "https://github.com/bluenviron/mediamtx/releases/download/${MTX_V}/mediamtx_${MTX_V}_linux_amd64.tar.gz" \
  | tar xz -C /usr/local/bin mediamtx
chmod +x /srv/ensemble/deploy/live-push.sh

# RTMPS in from creators' OBS. 1935 (plain RTMP) stays closed to the world:
# the ingest key travels in the URL path in cleartext, and creators stream
# from venue and hotel wifi. Only the local ffmpeg forwarders use 1935, over
# loopback, which the firewall does not touch.
ufw allow 1936/tcp
ufw deny 1935/tcp
```

Add to `/srv/ensemble/.env` (then `systemctl restart ensemble`):

```sh
LIVE_INGEST_URL=rtmps://ensemble.it.com/live
LIVE_HOOK_SECRET=$(openssl rand -hex 32)   # paste the value, not the command
```

The relay needs `LIVE_HOOK_SECRET` too, in **its own file** — not the app's
`.env`. `EnvironmentFile` loads a whole file, not one line of it, so pointing
the relay at `/srv/ensemble/.env` put every platform secret (Stripe, Resend,
the admin password) into its environment and into every `ffmpeg`, `curl` and
`jq` child it spawns:

```sh
# as root — paste the same value you put in .env
printf 'LIVE_HOOK_SECRET=%s\n' 'the-value-you-generated' > /etc/ensemble-relay.env
chown root:ensemble /etc/ensemble-relay.env
chmod 640 /etc/ensemble-relay.env
```

MediaMTX reads the TLS certificate Caddy already manages, so it needs to be
able to read that directory:

```sh
usermod -aG caddy ensemble   # or copy the cert/key somewhere ensemble owns
```

Then the unit:

```sh
cp /srv/ensemble/deploy/mediamtx.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now mediamtx
```

Smoke test: in the dashboard (Integrations → Social media, Enterprise plan),
copy the server + stream key into OBS and start streaming. Within a few
seconds `journalctl -u mediamtx -f` shows the publish, the page's Live section
shows on-air, and any platform with a saved key starts receiving. Stop the
stream and the badge drops on its own.

Bandwidth: forwarding one stream to three platforms is roughly 8 GB/hour of
egress. One regular streamer fits the droplet's included transfer; check
`vnstat` monthly before inviting more, and move the relay to its own droplet
when it outgrows this one.

## 11. Scheduled posts and newsletters (optional)

Creators can write a post or a newsletter now and have it go out later. The app
is request-driven and has nothing that wakes itself up, so cron does it.

```sh
# A secret only cron knows. Unset, /api/cron/run-due answers 404 and
# scheduling is simply off.
openssl rand -hex 32
```

Put it in `/srv/ensemble/.env` as `CRON_SECRET=`, restart, then add the tick as
the **service** user — the same user the backup job runs as:

```sh
crontab -e -u ensemble
* * * * * curl -fsS -X POST -H "x-cron-secret: THE-SECRET" http://127.0.0.1:3000/api/cron/run-due >> /srv/ensemble/backups/cron.log 2>&1
```

Three things about that line are deliberate:

**`127.0.0.1:3000`, not the public hostname.** The request never leaves the box,
so it does not consume a Caddy connection, and the secret is not sent over the
network at all.

**`-X POST`.** The route refuses GET. Anything that follows links in a page —
a scanner, a prefetch, a preview bot — must not be able to trigger a send by
fetching a URL.

**Redirecting into a directory that already exists.** `/srv/ensemble/backups` is
created in §8. Cron's shell opens the redirect *before* the command runs, so
pointing this at a directory that does not exist yet means the job never
executes and leaves no log saying why — the same trap the backup line documents.

Check it is running:

```sh
tail -f /srv/ensemble/backups/cron.log      # {"ok":true,"posts":0,...} once a minute
journalctl -u ensemble | grep '\[cron\]'    # one line per item actually sent
```

Every minute is deliberate: a creator who schedules 09:00 means 09:00, and the
work is one indexed query when there is nothing due.

Overlapping runs are safe. Each due row is claimed with a single UPDATE before
anything is sent, so a fan-out that outlasts the minute cannot be picked up
twice — which for a newsletter would mean mailing a list twice, and that cannot
be taken back. A run killed mid-send leaves rows claimed; they are swept back up
15 minutes later rather than stalling forever.

**Times are stored in UTC.** Creators pick a time in their own zone (Settings →
Time zone) and it is converted on the way in, so the droplet's `TZ` does not
matter and never needs setting.

## Notes

- **PLATFORM_HOSTS matters**: any hostname *not* in that list is treated as a
  creator custom domain. If the marketing site ever 404s, check this first.
- The Caddy `ask` endpoint (`/api/domains/check`) refuses certificates for
  unregistered domains — that's what stops randoms pointing DNS at you and
  burning Let's Encrypt rate limits. Caddy reaches it over localhost, so the
  Caddyfile returns 403 for it at the edge (it answers 200 vs 404, which would
  otherwise let anyone enumerate your customers' domains). The block is a
  snippet imported into every site block — a new block without the import
  re-exposes it.
- `ADMIN_PASSWORD` only applies when the database is first created; setting it
  afterwards does nothing, because `seedAdmin` returns early once the account
  exists. To change an already-seeded account, run the rotate script on the
  machine holding the database. The password arrives on stdin so it stays out
  of shell history and out of the process list, and every existing session for
  the account is dropped:

  ```sh
  cd /srv/ensemble
  read -rs NEWPW && printf '%s' "$NEWPW" | node scripts/set-admin-password.mjs
  ```

  The stored credential is a scrypt hash and is not reversible — if the
  password is lost, rotating is the only way back in, for anyone.
- **Watch egress if the live relay is on.** `scripts/check-egress.sh` projects
  the month from usage so far and stays quiet unless the projection runs over
  the droplet's allowance. `apt install -y vnstat && systemctl enable --now
  vnstat`, then `0 9 * * * /srv/ensemble/scripts/check-egress.sh`.
