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
# nightly snapshot of the DB, keeping 14 days (crontab -e as ensemble)
0 4 * * * sqlite3 /srv/ensemble/data/app.db ".backup /srv/ensemble/data/backup-$(date +\%u).db"
```

DigitalOcean droplet snapshots (weekly) cover the rest.

## 9. Updating the app

```sh
cd /srv/ensemble && git pull && npm ci && npm run build && sudo systemctl restart ensemble
```

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
- `ADMIN_PASSWORD` only applies when the database is first created. To change
  it later you currently need to update the user row manually.
