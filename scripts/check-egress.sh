#!/usr/bin/env bash
#
# Warn before the droplet's monthly transfer allowance runs out.
#
# The live relay is the reason this exists. Forwarding one stream to three
# platforms is roughly 8 GB/hour of egress, so a single creator streaming a few
# hours a week is a meaningful fraction of the included transfer, and the first
# sign of trouble is otherwise an overage bill.
#
# "Check vnstat monthly" was the previous plan. Nobody remembers to check
# anything monthly, so this checks and only speaks up when it matters — run it
# from cron and it is silent until the month is genuinely heading somewhere bad.
#
# Install (as root or the ensemble user):
#   apt install -y vnstat && systemctl enable --now vnstat   # once
#   chmod +x /srv/ensemble/scripts/check-egress.sh
#   crontab -e
#   0 9 * * * /srv/ensemble/scripts/check-egress.sh
#
# Exit codes: 0 within budget, 1 over the warning line. Cron mails the output
# on any output at all, so a quiet run means everything is fine.

set -euo pipefail

# DigitalOcean's smaller droplets include 1 TB/month. Override if the plan differs.
ALLOWANCE_GB="${ALLOWANCE_GB:-1000}"
# Warn at this share of the allowance, measured against how far into the month
# we are — so 60% used on day 3 is a warning while 60% on day 25 is not.
WARN_RATIO="${WARN_RATIO:-1.15}"
IFACE="${IFACE:-}"

if ! command -v vnstat >/dev/null 2>&1; then
  echo "✗ vnstat is not installed. apt install -y vnstat && systemctl enable --now vnstat" >&2
  exit 1
fi

# --json is stable across vnstat 2.x; the oneline format changed between
# releases and is not worth parsing.
if [ -n "$IFACE" ]; then
  JSON="$(vnstat --json m -i "$IFACE")"
else
  JSON="$(vnstat --json m)"
fi

read -r TX_BYTES DAY <<EOF
$(printf '%s' "$JSON" | python3 -c '
import json, sys, datetime
d = json.load(sys.stdin)
iface = d["interfaces"][0]
months = iface["traffic"]["month"]
if not months:
    print("0 1"); raise SystemExit
m = months[-1]
print(m["tx"], datetime.date.today().day)
')
EOF

TX_GB=$(python3 -c "print(f'{$TX_BYTES / 1000**3:.1f}')")
DAYS_IN_MONTH=$(python3 -c "
import calendar, datetime
t = datetime.date.today(); print(calendar.monthrange(t.year, t.month)[1])
")

# Straight-line projection: at this rate, where does the month finish?
PROJECTED=$(python3 -c "print(f'{$TX_GB / max($DAY,1) * $DAYS_IN_MONTH:.0f}')")
LIMIT=$(python3 -c "print(f'{$ALLOWANCE_GB * $WARN_RATIO:.0f}')")

if [ "$(python3 -c "print(1 if $PROJECTED > $LIMIT else 0)")" = "1" ]; then
  cat >&2 <<MSG
Ensemble egress warning — $(hostname)

  Used so far this month : ${TX_GB} GB  (day ${DAY} of ${DAYS_IN_MONTH})
  Projected month total  : ${PROJECTED} GB
  Included allowance     : ${ALLOWANCE_GB} GB

At this rate the month finishes over the allowance. The live relay is the
usual cause — roughly 8 GB/hour per stream forwarded to three platforms.
Move the relay to its own droplet if this is the new normal rather than a
one-off (DEPLOY.md §10).
MSG
  exit 1
fi

exit 0
