# SocialConstruct

A platform for content creators to manage their landing pages/websites from one dashboard.
Creators sign up with their name and business name, then pick one of two paths:

1. **Start From Scratch** — SocialConstruct hosts a landing page for bonus content, creator info,
   and merch sales. Built with a copy & paste section editor, published at `/s/<their-slug>`.
2. **Integrate a Current Website** — they submit their existing site for a custom quote;
   requests land in the admin inbox at `/admin`.

## Packages

| Plan | Price | Includes |
|------|-------|----------|
| Basic | $25/mo | Landing page builder, basic database limits (6 sections), standard server, no payment integrations |
| Pro | $35/mo | Large database (20 sections), fast reliable server, Stripe payment integrations |
| Enterprise | $75/mo* | Everything in Pro + best server, help desk support, 3rd-party calendar integrations, custom chatrooms, newsletters/memberships |

\* Enterprise price is a placeholder — edit it in `src/lib/plans.ts` (single source of truth
for prices, feature lists, and limits; the marketing page, onboarding, and settings all read from it).

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Admin

Sign up with the admin email (defaults to `j@cub.pw`, override with the `ADMIN_EMAIL` env var)
to get the **Quote Requests** inbox at `/admin`, where integration requests can be marked
new / quoted / closed.

## How it's put together

- **Next.js App Router + Tailwind**, server actions for all mutations (no client API layer).
- **SQLite** (`better-sqlite3`) at `data/app.db`, created automatically on first run.
  Tables: users, sessions, sites, sections, quote_requests, leads. Delete `data/` to reset.
- **Auth**: scrypt-hashed passwords, httpOnly cookie sessions (30 days). `src/lib/auth.ts`.
- **Builder**: section templates live in `src/lib/sections.ts` — each defines its fields,
  defaults, and the minimum plan required (Newsletter/Calendar/Chatroom are Enterprise-only).
  Adding a new section type there makes it appear in the builder and requires a matching
  renderer case in `src/app/s/[slug]/page.tsx`.
- **Plan gating**: section limits, Stripe buy buttons, and integrations all check the
  creator's plan at render/action time, so downgrades gate features without deleting content.

## Not wired up yet (next steps)

- **Billing**: plan selection is instant/free right now. Wire Stripe subscriptions
  ($25/$35/$75 prices) around `startFromScratch` and `changePlan` in `src/lib/actions.ts`.
- **Creator merch checkout** works today via pasted Stripe payment links (Pro+).
- **Chatroom** renders a static clubhouse preview — needs a real-time backend.
- **Newsletter sending**: emails are collected (visible in Integrations) but nothing sends yet.
