# Ensemble

A platform for content creators to run their web presence from one dashboard.
Creators sign up with their name and business name, then pick one of two paths:

1. **Start From Scratch** — Ensemble hosts a landing page for bonus content, creator info,
   and merch sales. Built with a copy & paste section editor, published at `/<their-slug>`.
2. **Use their existing website** — two integration options, both driven from the dashboard:
   - **Website pairing** (primary, Dashboard → My Website): the creator enters their site's
     URL, Ensemble scans the page and pulls every headline, paragraph, image and video into
     an editable inventory. They paste a one-line snippet (carrying their private pairing key)
     into their site, and every edit made in the dashboard is applied to the live site
     in place — no layout or style changes, content only.
   - **Embed** (secondary): a one-line script plus a container div renders their hosted
     sections inside their existing site (`/embed-demo` shows it live on a mock site).
   - There's also a white-glove path: submit the site for a custom quote; requests land
     in the admin inbox at `/admin`.

## Packages

| Plan | Price | Includes |
|------|-------|----------|
| Basic | $25/mo | Landing page builder, basic database limits (6 sections), standard server, no payment integrations |
| Pro | $45/mo | Large database (20 sections), fast reliable server, Stripe payment integrations, daily analytics chart |
| Enterprise | $75/mo* | Everything in Pro + best server, help desk support, 3rd-party calendar integrations, custom chatrooms, newsletters/memberships, referrer analytics, unlimited sections |

\* Enterprise price is a placeholder — edit it in `src/lib/plans.ts` (single source of truth
for prices, feature lists, and limits; the marketing page, onboarding, and settings all read from it).

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Accounts

- **Admin**: seeded on first run as `rileyg0035@gmail.com` / `admin1234` (override with `ADMIN_EMAIL` /
  `ADMIN_PASSWORD` env vars before the database is first created). Comes with an Enterprise
  site (`/hq`) and the **Admin Inbox** at `/admin` — quote requests and Enterprise support
  tickets (reply + status).
- **Demo**: a public example creator page at `/demo` (locked account), plus a read-only
  demo dashboard at `/demo/dashboard`.

## The dashboard

| Page | What it does | Tier |
|------|--------------|------|
| Overview | Page status, publish toggle, plan/sections/subscriber stats | all |
| Page Builder | Copy & paste section editor with per-plan section limits | all |
| My Website | Pair an existing website: scan → edit content → one-line snippet applies edits in place. Pause/resume, rescan, disconnect, reset pairing key | all |
| Analytics | Page views (hosted + embed, with referrers), totals | totals: all · daily chart: Pro+ · referrers: Ent |
| Audience | Newsletter subscriber list, delete, CSV export | Enterprise |
| Chatroom | Real visitor chat on the hosted page; moderate/delete, on/off | Enterprise |
| Integrations | Stripe key, calendar URL, chatroom/newsletter toggles | per plan |
| Support | Help desk tickets (answered from the Admin Inbox) | Enterprise |
| Settings | Page URL, tagline, accent color, plan switching | all |

Locked pages show an upgrade gate; the sidebar badges Enterprise-only items. All gating is
enforced server-side in the actions/APIs, not just hidden in the UI.

## Website pairing — how it works

- **Scan**: `src/lib/scrape.ts` fetches the creator's URL (browser-like User-Agent, SSRF
  guard against private addresses in production) and extracts editable elements
  (h1–h6/p/li/blockquote/figcaption text, `img`, `iframe`, `video`) with stable CSS paths
  into the `site_content` table.
- **Edit**: Dashboard → My Website lists each piece; saving stores overrides (revert by
  restoring the original text or blanking a URL field).
- **Apply**: the pasted `/connect.js` snippet fetches `/api/overrides/<token>` (CORS-open,
  only edited values) and swaps text/`src` on those exact elements at page load. The fetch
  doubles as a pairing heartbeat ("Snippet active — last seen … on <host>").
- **Caveats**: JS-rendered sites scan less completely; editing a text block flattens inline
  markup inside it; visitors only see edits once the app is publicly reachable (deploy or
  tunnel) — with `localhost` in the snippet only the dev machine sees them.

## How it's put together

- **Next.js App Router + Tailwind**, server actions for all mutations (no client API layer).
- **SQLite** (`better-sqlite3`) at `data/app.db`, created automatically on first run.
  Tables: users, sessions, sites, sections, quote_requests, leads, chat_messages,
  support_tickets, page_views, connections, site_content. Delete `data/` to reset.
- **Auth**: scrypt-hashed passwords, httpOnly cookie sessions (30 days). `src/lib/auth.ts`.
- **Builder**: section templates live in `src/lib/sections.ts` — each defines its fields,
  defaults, and the minimum plan required. Adding a new section type there makes it appear
  in the builder and requires a matching renderer case in `src/app/s/[slug]/page.tsx`
  (and `src/lib/embed.ts` if it should render through the embed).
- **Embed**: `/embed.js` + `/api/content/<token>` serve hosted sections to external sites.
  Draft sites 404 (Unpublish is a kill switch everywhere); plan gating is applied
  server-side when building the payload.
- **Plan gating**: section limits, Stripe buy buttons, and integrations all check the
  creator's plan at render/action time, so downgrades gate features without deleting content.

## Billing (Stripe)

Subscription billing is built in and activates when Stripe keys are present. Without
keys the app runs in **preview mode**: plan changes are instant and free.

Set these env vars (e.g. in `.env.local`):

```
STRIPE_SECRET_KEY=sk_test_...    # from dashboard.stripe.com/apikeys
STRIPE_WEBHOOK_SECRET=whsec_...  # from `stripe listen` or the webhook dashboard
APP_URL=http://localhost:3000    # public origin used in checkout redirect URLs
```

For local webhooks: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

How it behaves with keys set:

- Products/prices are created automatically on first use (lookup keys
  `ensemble_<plan>_monthly`) — no manual Stripe dashboard setup.
- **Start From Scratch** creates the site, then redirects to Stripe Checkout; the page
  can't be published until the subscription is active (webhook-confirmed).
- **Plan switches** on an active subscription are prorated in place; without one they
  go through checkout.
- **Settings → Billing** opens the Stripe customer portal (invoices, card, cancel).
- Webhooks handled at `/api/stripe/webhook`: checkout completed, subscription
  updated/deleted (deletion unpublishes the page), payment failed (marks past due).

## Not wired up yet (next steps)

- **Public URL**: pairing/embed snippets point at localhost until the app is deployed
  (needs a persistent host for SQLite — Fly/Railway/VPS) or tunneled (cloudflared/ngrok).
- **Multi-page pairing**: a connection scans one URL (usually the homepage); per-page
  connections would need a `connections`/`site_content` keyed by page.
- **Rate limiting**: newsletter signup and chat posting have no throttling.
- **Newsletter sending**: emails are collected (Audience page, CSV export) but nothing sends yet.
