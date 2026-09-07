#!/usr/bin/env python3
"""
Render docs/launch-checklist.pdf.

The checklist is a printable thing — it gets ticked with a pen next to a
terminal while someone works through a droplet — so the artifact is committed
alongside this script rather than generated on demand. This file is the source
of record: change the text here and re-run, never edit the PDF.

Every command in Part 5 is lifted from DEPLOY.md. When that runbook changes,
this needs the same edit, and the reason each step exists is written next to it
so the two can be compared rather than guessed at.

    pip install reportlab        # not a project dependency; nothing else needs it
    python3 scripts/make-launch-checklist.py
"""

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle,
    KeepTogether,
)

import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "launch-checklist.pdf")
os.makedirs(os.path.dirname(OUT), exist_ok=True)

INK = colors.HexColor("#16181d")
SOFT = colors.HexColor("#454b55")
MUTED = colors.HexColor("#7b828d")
RULE = colors.HexColor("#d7dbe0")
ACCENT = colors.HexColor("#5b3fa8")
WARN = colors.HexColor("#a5442c")
CODEBG = colors.HexColor("#f2f3f6")
OKGREEN = colors.HexColor("#1f6b45")

ss = getSampleStyleSheet()

H1 = ParagraphStyle("H1", parent=ss["Title"], fontName="Helvetica-Bold",
                    fontSize=21, leading=25, textColor=INK, alignment=TA_LEFT,
                    spaceAfter=2)
SUB = ParagraphStyle("SUB", fontName="Helvetica", fontSize=9.5, leading=13.5,
                     textColor=MUTED, spaceAfter=14)
H2 = ParagraphStyle("H2", fontName="Helvetica-Bold", fontSize=13, leading=16,
                    textColor=INK, spaceBefore=17, spaceAfter=3)
H2NOTE = ParagraphStyle("H2NOTE", fontName="Helvetica-Oblique", fontSize=8.6,
                        leading=12, textColor=MUTED, spaceAfter=8)
H3 = ParagraphStyle("H3", fontName="Helvetica-Bold", fontSize=10, leading=13,
                    textColor=ACCENT, spaceBefore=11, spaceAfter=4)
BODY = ParagraphStyle("BODY", fontName="Helvetica", fontSize=9.3, leading=13,
                      textColor=SOFT, spaceAfter=6)
ITEM = ParagraphStyle("ITEM", fontName="Helvetica-Bold", fontSize=9.3,
                      leading=12.5, textColor=INK)
WHY = ParagraphStyle("WHY", fontName="Helvetica", fontSize=8.4, leading=11.5,
                     textColor=MUTED, spaceBefore=1.5)
CODE = ParagraphStyle("CODE", fontName="Courier", fontSize=7.9, leading=11,
                      textColor=INK, backColor=CODEBG,
                      borderPadding=(4, 5, 4, 5), spaceBefore=3.5,
                      leftIndent=0, spaceAfter=1)
CALLOUT = ParagraphStyle("CALLOUT", fontName="Helvetica", fontSize=8.8,
                         leading=12.5, textColor=INK)


def page_furniture(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7.4)
    canvas.setFillColor(MUTED)
    canvas.drawString(0.85 * inch, 0.55 * inch, "Ensemble - path to production - 7 Sep 2026")
    canvas.drawRightString(LETTER[0] - 0.85 * inch, 0.55 * inch, "Page %d" % doc.page)
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.5)
    canvas.line(0.85 * inch, 0.72 * inch, LETTER[0] - 0.85 * inch, 0.72 * inch)
    canvas.restoreState()


def hr(space_before=3, space_after=7):
    t = Table([[""]], colWidths=[6.8 * inch], rowHeights=[0.5])
    t.setStyle(TableStyle([("LINEABOVE", (0, 0), (-1, -1), 0.7, RULE)]))
    return [Spacer(1, space_before), t, Spacer(1, space_after)]


def check_row(title, why=None, cmds=None, warn=False):
    """One checklist line: an empty box to tick, then the item."""
    inner = [Paragraph(title, ITEM)]
    if why:
        inner.append(Paragraph(why, WHY))
    for c in (cmds or []):
        safe = c.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        inner.append(Paragraph(safe, CODE))

    box = Table([[""]], colWidths=[10], rowHeights=[10])
    box.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.9, WARN if warn else colors.HexColor("#8b929c")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
    ]))

    row = Table([[box, inner]], colWidths=[0.30 * inch, 6.5 * inch])
    row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (0, 0), 2.5),
        ("TOPPADDING", (1, 0), (1, 0), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    return KeepTogether(row)


def callout(text, tone=WARN):
    p = Paragraph(text, CALLOUT)
    t = Table([[p]], colWidths=[6.8 * inch])
    t.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0, colors.white),
        ("LINEBEFORE", (0, 0), (0, -1), 2.2, tone),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#faf7f5") if tone == WARN else colors.HexColor("#f4f8f5")),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return [Spacer(1, 3), t, Spacer(1, 8)]


story = []
A = story.append

# ---------------------------------------------------------------- header
A(Paragraph("Ensemble: the path to production", H1))
A(Paragraph(
    "Prepared 7 September 2026 &nbsp;|&nbsp; RG-GitUser/ensemble &nbsp;|&nbsp; "
    "main at <font face='Courier'>c059e23</font>", SUB))

A(Paragraph("Where things stand", H2))
A(Paragraph(
    "<b>PR #3 is merged.</b> main carries the 57 audit findings, RTMPS stream keys, the "
    "social connection check, per-creator relay egress metering, and sign-in with Google, "
    "Microsoft and Yahoo. CI is green on it.", BODY))
A(Paragraph(
    "<b>The hardening branch question is settled.</b> Roughly 25 of its fixes were checked "
    "against main one at a time. Every one was already there, and where the two differed "
    "main's was better placed: referrer sanitising moved inside recordPageView so no caller "
    "can skip it, stream-key injection closed with NUL-delimited targets rather than base64, "
    "the unpublished-metadata gate moved into siteForHost so the title and body cannot "
    "disagree. A test merge conflicted in 30 of 32 files, which is what two parallel rewrites "
    "of the same code look like. It is archived as the tag "
    "<font face='Courier'>archive/hardening</font> and the branch is deleted. Four other "
    "merged branches were removed with it.", BODY))
A(Paragraph(
    "<b>Two PRs are open and green.</b> #4 fixes a test runner that could not execute on "
    "Windows at all. #5 closes two places the app promised something no configuration could "
    "deliver.", BODY))
A(Paragraph(
    "<b>Still true from the last checklist:</b> nothing enforces that CI passes before a "
    "merge, and none of the non-code launch blockers have moved.", BODY))

# ---------------------------------------------------------------- part 1
A(Paragraph("Part 1 - Merge what is ready", H2))
A(Paragraph("Ten minutes. Everything after this assumes main is current.", H2NOTE))

A(check_row(
    "Merge PR #4 - the test runner",
    "npm test printed 'Test sources failed to compile' on a tree that compiles clean, because "
    "the compile never ran: npx on Windows is npx.cmd and spawnSync will not resolve .cmd. "
    "Until this merges, the suite cannot run on the machine the work happens on."))
A(check_row(
    "Merge PR #5 - two promises the app could not keep",
    "TikTok advertised one-click publishing that no environment value could unlock, and "
    ".env.example shipped an RFC 5737 documentation IP as live DNS instructions."))
A(check_row(
    "Merge this checklist",
    "The PDF and the script that renders it. A checked-in binary nobody can regenerate goes "
    "stale silently, which is the failure this repo keeps finding in its own comments."))
A(check_row(
    "Make the CI check required on main",
    "Settings -> Branches -> add a rule for main -> require the 'check' status. Both open PRs "
    "are mergeable right now with nothing verifying that CI passed. They happen to be green. "
    "The next one might not be.",
    warn=True))

# ---------------------------------------------------------------- part 2
A(Paragraph("Part 2 - The droplet's .env", H2))
A(Paragraph(
    "New in this revision. The app was run in production mode and every environment gate read "
    "in the code. These are the values whose absence does not announce itself.", H2NOTE))

A(check_row(
    "APP_URL is the public origin",
    "It defaults to http://localhost:3000, and that default is what builds password-reset and "
    "account-recovery links. Unset in production, the mail sends successfully and every "
    "recipient gets a link to their own machine. Nothing errors.",
    ["APP_URL=https://ensemble.it.com"],
    warn=True))
A(check_row(
    "RESEND_API_KEY and MAIL_FROM are set",
    "All outbound mail is gated on RESEND_API_KEY. Without it there is no password reset, no "
    "account recovery and no newsletters - the Forgot page says so on screen. In development "
    "that is a banner; in production it means a locked-out customer has no way back in.",
    ["RESEND_API_KEY=re_...        # domain verified at resend.com",
     "MAIL_FROM=Ensemble <news@ensemble.it.com>",
     "AUTH_MAIL_FROM=Ensemble <noreply@ensemble.it.com>"],
    warn=True))
A(check_row(
    "PLATFORM_HOSTS lists every hostname Caddy routes to the app",
    "Defaults to localhost,127.0.0.1. Sites.* included, or a direct visit to the CNAME target "
    "404s as an unknown customer domain.",
    ["PLATFORM_HOSTS=ensemble.it.com,www.ensemble.it.com,sites.ensemble.it.com"]))
A(check_row(
    "DOMAIN_A_RECORD is uncommented and set to the reserved IP",
    "It now ships commented out on purpose. The value that used to ship, 203.0.113.10, is "
    "documentation space routed by nobody - so forgetting this edit did not fail, it told "
    "every creator to point their apex A record at an address that never answers. Commented, "
    "the DNS step hides instead.",
    ["#DOMAIN_A_RECORD=203.0.113.10     <- as shipped",
     "DOMAIN_A_RECORD=104.248.107.30    <- the droplet's reserved IP"],
    warn=True))
A(check_row(
    "Stripe keys are set, or billing is disabled on purpose",
    "With NODE_ENV=production and no STRIPE_SECRET_KEY, billing fails closed and logs why. "
    "That is the fix for free-Enterprise-by-default. Paid features are then unavailable to "
    "everyone until one of the two lines below exists.",
    ["STRIPE_SECRET_KEY=sk_live_...",
     "STRIPE_WEBHOOK_SECRET=whsec_...",
     "# or, deliberately:",
     "ENSEMBLE_BILLING_DISABLED=1"],
    warn=True))
A(check_row(
    "ADMIN_PASSWORD is still commented out",
    "It is seeded once and the mistake is permanent, against an admin address published in "
    "this repo. Unset, a random password is generated and printed to the log on first start.",
    ["grep -n '^ADMIN_PASSWORD' /srv/ensemble/.env    # expect: no output",
     "journalctl -u ensemble | grep -i 'admin password'"],
    warn=True))
A(check_row(
    "Optional, and safe to leave unset",
    "Each is inert when absent rather than broken. SSO providers missing either value are "
    "simply not rendered on the login page. The relay needs both of its values or neither.",
    ["GOOGLE_/MICROSOFT_/YAHOO_CLIENT_ID + _CLIENT_SECRET   # sign-in",
     "THREADS_/INSTAGRAM_/FACEBOOK_/PINTEREST_/REDDIT_APP_ID + _APP_SECRET",
     "LIVE_INGEST_URL + LIVE_HOOK_SECRET                    # relay; both or neither",
     "LIVE_EGRESS_BYTES_PER_SITE                            # default 250 GB/creator/month",
     "INTUIT_CLIENT_ID + INTUIT_CLIENT_SECRET               # QuickBooks",
     "STRIPE_AUTOMATIC_TAX=1                                # only after Tax is configured",
     "WIP_MODE=1                                            # holding page"]))

story.extend(callout(
    "<b>Set Stripe Tax up in the dashboard BEFORE setting the flag.</b> In that order. "
    "STRIPE_AUTOMATIC_TAX=1 before Tax is configured makes every checkout fail."))

A(check_row(
    "The file is not world-readable",
    "Every secret lives in it. The default umask leaves it mode 644.",
    ["chmod 600 /srv/ensemble/.env",
     "stat -c '%a %U:%G' /srv/ensemble/.env    # expect: 600 ensemble:ensemble"]))

# ---------------------------------------------------------------- part 3
A(Paragraph("Part 3 - Launch blockers that are not code", H2))
A(Paragraph(
    "None of these can be written for you. The first is the longest pole - start it today.",
    H2NOTE))

A(check_row(
    "Legal review by a qualified person",
    "Terms with governing law, dispute resolution and a refund policy - you bill monthly and "
    "deliberately do not prorate, which has to be somewhere a customer agreed to. A privacy "
    "page naming Stripe, Resend and DigitalOcean as subprocessors, with retention periods and "
    "data-subject rights. An acceptable-use policy with an abuse contact and a DMCA process.",
    warn=True))
A(check_row(
    "Stripe: live mode and one full lifecycle",
    "Register the webhook against the six events billing.ts handles, then run it end to end: "
    "subscribe, upgrade, downgrade, fail a payment, cancel, delete the account - and confirm "
    "the card actually stops. That last step is the finding most likely to become a "
    "chargeback.",
    warn=True))
A(check_row(
    "Restore a backup onto a scratch droplet",
    "This has only ever been done on a laptop. It is the one step that turns a backup from a "
    "belief into a backup. Do it once before launch and once a quarter after.",
    warn=True))
A(check_row(
    "Make one real post per social provider",
    "OAuth apps are on production now, but that path has never been proven against a live API. "
    "Treat the first post to each provider as a test, not as a launch. The 'Check connection' "
    "button on Integrations verifies a token without publishing anything."))
A(check_row(
    "Register the SSO apps, if you want sign-in live",
    "Optional. Any provider missing either value is simply not rendered on the login page, so "
    "leaving these unset keeps email-and-password as the only way in. Redirect URIs are in "
    ".env.example."))

# ---------------------------------------------------------------- part 4
A(Paragraph("Part 4 - Server security checklist", H2))
A(Paragraph(
    "Run as root on the droplet unless a line says otherwise. Commands are from DEPLOY.md; "
    "each box is one thing to confirm rather than assume.", H2NOTE))

A(Paragraph("A. Accounts and firewall", H3))
A(check_row(
    "Service account exists and is NOT in sudo",
    "Compromising the app must not be the same as owning the box. Administer as root or from "
    "your own sudo-capable login.",
    ["adduser ensemble",
     "groups ensemble          # must NOT list sudo",
     "deluser ensemble sudo    # only if it does"]))
A(check_row(
    "Firewall allows only SSH, HTTP and HTTPS",
    None,
    ["ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable",
     "ufw status verbose"]))

A(Paragraph("B. Secrets and service hardening", H3))
A(check_row(
    "The relay has its OWN env file, not the app's",
    "EnvironmentFile loads a whole file, not one line. Pointing the relay at the app's .env put "
    "every platform secret into its environment and into every ffmpeg, curl and jq child it "
    "spawns.",
    ["printf 'LIVE_HOOK_SECRET=%s\\n' 'the-value-you-generated' > /etc/ensemble-relay.env",
     "chown root:ensemble /etc/ensemble-relay.env",
     "chmod 640 /etc/ensemble-relay.env"]))
A(check_row(
    "systemd sandboxing is actually in effect",
    "These are set in deploy/ensemble.service. Confirm the running unit picked them up rather "
    "than trusting the file on disk.",
    ["systemctl show ensemble -p NoNewPrivileges -p ProtectSystem \\",
     "  -p MemoryMax -p StartLimitBurst -p StartLimitIntervalSec",
     "# expect NoNewPrivileges=yes, ProtectSystem=strict, a real MemoryMax"]))

A(Paragraph("C. Backups", H3))
A(check_row(
    "sqlite3 is installed",
    "Not optional: backup.sh and the whole documented restore shell out to it. Without it the "
    "nightly job died on its first command every night, silently, under set -euo pipefail.",
    ["apt-get install -y sqlite3", "command -v sqlite3"]))
A(check_row(
    "The backups directory exists BEFORE the crontab line",
    "Load-bearing ordering. Cron's shell opens the redirect before the script runs, so on a "
    "fresh droplet the job never executed - and because the failure was in the redirect, there "
    "was no log to notice it in.",
    ["chmod +x /srv/ensemble/scripts/backup.sh",
     "mkdir -p /srv/ensemble/backups",
     "crontab -e -u ensemble",
     "0 4 * * * /srv/ensemble/scripts/backup.sh >> /srv/ensemble/backups/backup.log 2>&1"]))
A(check_row(
    "rclone is configured as the SERVICE user, not root",
    "The cron job runs as ensemble and rclone reads its config from the running user's home. A "
    "remote configured as root is invisible to the job that needs it.",
    ["sudo -iu ensemble rclone config",
     "grep -n '^BACKUP_REMOTE' /srv/ensemble/.env"]))

story.extend(callout(
    "<b>Never back up the database with cp.</b> It runs in WAL mode, so at any moment the most "
    "recent writes are in app.db-wal rather than app.db. Copying app.db alone gets you an "
    "almost empty database that still opens cleanly - the worst kind of bad backup. Use "
    "<font face='Courier'>sqlite3 .backup</font>, or take app.db, app.db-wal and app.db-shm "
    "together."))

A(Paragraph("D. Live relay", H3))
A(check_row(
    "RTMPS is open; plain RTMP is closed to the world",
    "The ingest key travels in the URL path in cleartext, and creators stream from venue and "
    "hotel wifi. Only the local ffmpeg forwarders use 1935, over loopback, which the firewall "
    "does not touch.",
    ["ufw allow 1936/tcp", "ufw deny 1935/tcp",
     "chmod +x /srv/ensemble/deploy/live-push.sh"]))

A(Paragraph("E. Monitoring", H3))
A(check_row(
    "Caddy's log directory exists",
    None,
    ["mkdir -p /var/log/caddy && chown caddy:caddy /var/log/caddy"]))
A(check_row(
    "An uptime check points at the health route and wakes a phone",
    "1-5 minute interval. It touches the database, so it distinguishes 'up' from 'up and "
    "returning 500 to everyone' - which nothing outside the box could previously tell.",
    ["https://ensemble.it.com/api/health"]))
A(check_row(
    "You know how to read the logs when it goes wrong",
    None,
    ["systemctl status ensemble        # 'failed', not endlessly 'activating'",
     "journalctl -u ensemble -n 50",
     "tail -f /var/log/caddy/access.log"]))

# ---------------------------------------------------------------- part 5
A(Paragraph("Part 5 - Deploy, and be able to undo it", H2))
A(Paragraph(
    "main is 17 commits ahead of what is running. Do not deploy until Part 2 is done: this "
    "release is the one where billing fails closed.", H2NOTE))

A(check_row(
    "Snapshot first, always",
    "npm ci deletes node_modules before it starts and next build overwrites .next, on a box "
    "that may need swap to build at all. A build that OOMs halfway leaves no working previous "
    "version to fall back to.",
    ["sudo -iu ensemble bash -lc 'cd /srv/ensemble && cp -a .next ../next-prev \\",
     "  && git rev-parse HEAD > ../deployed-sha'"],
    warn=True))
A(check_row(
    "Update as the service user, never as root",
    "The repo is owned by ensemble, and building as root leaves root-owned .next/ and "
    "node_modules/ the service cannot write to.",
    ["sudo -iu ensemble bash -lc 'cd /srv/ensemble && git pull && npm ci && npm run build'",
     "systemctl restart ensemble",
     "curl -fsS https://ensemble.it.com/api/health   # expect: {\"status\":\"ok\"}"]))
A(check_row(
    "Know the rollback before you need it",
    None,
    ["sudo -iu ensemble bash -lc 'cd /srv/ensemble \\",
     "  && git checkout $(cat ../deployed-sha) && rm -rf .next && cp -a ../next-prev .next'",
     "systemctl restart ensemble"]))
A(check_row(
    "Take the pending reboot at a time you choose",
    "The droplet login banner reports a required restart. Better now, deliberately, than "
    "halfway through a deploy."))

A(Paragraph("F. Verify from OUTSIDE the box", H3))
A(Paragraph(
    "Run these from your laptop, not the droplet. Several of these controls only mean anything "
    "when tested from the internet.", H2NOTE))
A(check_row(
    "Health route answers",
    None,
    ["curl -s -o /dev/null -w '%{http_code}\\n' https://ensemble.it.com/api/health   # 200"]))
A(check_row(
    "Security headers are present and http redirects to https",
    None,
    ["curl -sI https://ensemble.it.com | grep -iE 'strict-transport|x-content-type'",
     "curl -sI http://ensemble.it.com | head -1        # expect 301/308"]))
A(check_row(
    "The on-demand-TLS ask endpoint is blocked at the edge",
    "Blocking it is what stops outsiders enumerating your customers.",
    ["curl -s -o /dev/null -w '%{http_code}\\n' \\",
     "  'https://ensemble.it.com/api/domains/check?domain=example.com'   # not 200"]))
A(check_row(
    "The live hook routes refuse an unauthenticated caller",
    None,
    ["curl -s -o /dev/null -w '%{http_code}\\n' \\",
     "  'https://ensemble.it.com/api/live/targets?key=whatever'          # expect 401"]))
A(check_row(
    "A password reset arrives, and its link points at the real domain",
    "The single check that proves Part 2 landed: mail configured, and APP_URL not left on its "
    "localhost default.",
    warn=True))

# ---------------------------------------------------------------- part 6
A(Paragraph("Part 6 - Still open in the code", H2))
A(Paragraph("Not blocking a launch, but worth knowing they are outstanding.", H2NOTE))
A(check_row(
    "Newsletter sending from the creator's own mailbox",
    "The other half of the email work. Gmail caps at about 500 recipients/day (2,000 on "
    "Workspace), Outlook about 300, Yahoo similar, and all three treat list mail through a "
    "personal mailbox as a ToS matter. Proposed design: show the cap against their real "
    "subscriber count before they send, refuse rather than half-deliver, keep Resend for "
    "anyone above it."))
A(check_row(
    "Relay push retry",
    "If one ffmpeg dies on a platform hiccup, that destination is gone for the rest of the "
    "stream and the creator is not told. Deliberately not shipped untested: it is signal "
    "handling in a live path, and getting it wrong leaves stray pushes holding a frozen frame "
    "on someone's channel. Needs a real MediaMTX and a real stream to verify."))
A(check_row(
    "Upload filenames are still guessable",
    "theme-<siteId>-<kind>-<timestamp>. Renaming to random ids is a migration touching every "
    "stored config value, and the exposure is a draft's imagery rather than anything "
    "executable. Documented in the route and left deliberately."))
A(check_row(
    "TikTok publishing - resolved in PR #5, but not implemented",
    "It no longer advertises one-click publishing it cannot do. Wiring it for real needs a "
    "provider written against an API that wants video uploads and an audited app, which is not "
    "a gap the runbook can close. Flip authType back to 'oauth' in the same commit that adds "
    "the provider."))

story.extend(hr(10, 4))
A(Paragraph(
    "Every command above is from DEPLOY.md as it stands on main. Items marked with a red box "
    "are the ones that cost real money or real trust if skipped.", WHY))

doc = BaseDocTemplate(OUT, pagesize=LETTER,
                      leftMargin=0.85 * inch, rightMargin=0.85 * inch,
                      topMargin=0.7 * inch, bottomMargin=0.85 * inch,
                      title="Ensemble - path to production",
                      author="Prepared for Riley Gaffney")
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="f")
doc.addPageTemplates([PageTemplate(id="all", frames=[frame], onPage=page_furniture)])
doc.build(story)
print("wrote", OUT)
