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
usermod -aG sudo ensemble
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable

# Node 22 LTS + build tools (better-sqlite3 compiles natively)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs build-essential python3

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

```sh
sudo -iu ensemble
git clone <your-repo> /srv/ensemble   # or rsync the project up
cd /srv/ensemble
cp .env.example .env                  # then EDIT IT:
#  - DOMAIN_A_RECORD = the reserved IP
#  - ADMIN_PASSWORD  = a real password (seeded on FIRST start — set it now)
npm ci
npm run build
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
curl -s http://localhost:3000/api/domains/check?domain=x.com # 404 (unknown domain)
```

Then in the dashboard: Settings → connect a custom domain you control, add
its A record → the first HTTPS visit mints its certificate automatically.

## 8. Backups

Everything mutable lives in `/srv/ensemble/data/` (SQLite DB + uploads).

```sh
chmod +x /srv/ensemble/scripts/backup.sh
crontab -e   # as the ensemble user
0 4 * * * /srv/ensemble/scripts/backup.sh >> /srv/ensemble/backups/backup.log 2>&1
```

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
rclone config                      # add a remote, e.g. "spaces"
echo 'BACKUP_REMOTE=spaces:ensemble-backups' >> /srv/ensemble/.env
```

Without `BACKUP_REMOTE` the script still runs and says the copies are local
only. DigitalOcean droplet snapshots (weekly) cover the rest of the disk.

### Restoring

```sh
systemctl stop ensemble

cd /srv/ensemble/data
mv app.db app.db.broken                    # keep it: it may still have the WAL
rm -f app.db-wal app.db-shm                # stale WAL against a new DB corrupts it
cp /srv/ensemble/backups/app-3.db app.db   # pick the day you want
tar xzf /srv/ensemble/backups/uploads-3.tar.gz -C /srv/ensemble/data

chown -R ensemble:ensemble /srv/ensemble/data
sqlite3 app.db "PRAGMA integrity_check;"   # expect: ok
systemctl start ensemble
```

Deleting the old `-wal` and `-shm` matters: SQLite will try to replay a
leftover WAL against the restored file, which is not the database it belongs
to. Restore is worth rehearsing once on a throwaway droplet — an untested
backup is a guess.

## 9. Updating the app

```sh
# as root — the repo is owned by the ensemble user, and building as root
# leaves root-owned .next/ and node_modules/ the service cannot write to.
sudo -iu ensemble bash -lc 'cd /srv/ensemble && git pull && npm ci && npm run build'
systemctl restart ensemble
```

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

# RTMP in from creators' OBS
ufw allow 1935/tcp
```

Add to `/srv/ensemble/.env` (then `systemctl restart ensemble`):

```sh
LIVE_INGEST_URL=rtmp://ensemble.it.com/live
LIVE_HOOK_SECRET=$(openssl rand -hex 32)   # paste the value, not the command
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
