# Registering the social developer apps

This is the owner-side work the framework can't do for you. Each platform needs
its own developer app, its own credentials in `.env`, and — for public use —
its own App Review.

Until a platform's credentials exist, its connect button shows a
"not set up yet" state. Nothing breaks; it just isn't offered.

## What every platform asks for

Have these ready before you start — the same four things come up every time:

- **Redirect URI**: `https://ensemble.it.com/api/oauth/<platform>/callback`
- **Privacy policy URL** — a public page. Reviewers do check it loads.
- **Terms of service URL** — same.
- **Data deletion**: a URL or callback where a user can request their data be
  removed. Meta requires this; the others increasingly ask.
- **A screencast** showing a real user connecting and posting. This is what
  most reviews are actually judged on. Record it against the live site.

## Per platform

| Platform | Console | Env vars |
|---|---|---|
| Threads | developers.facebook.com/apps | `THREADS_APP_ID` / `THREADS_APP_SECRET` |
| Instagram | developers.facebook.com/apps | `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` |
| Facebook | developers.facebook.com/apps | `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` |
| Pinterest | developers.pinterest.com/apps | `PINTEREST_APP_ID` / `PINTEREST_APP_SECRET` |
| Reddit | reddit.com/prefs/apps | `REDDIT_APP_ID` / `REDDIT_APP_SECRET` |

Threads, Instagram and Facebook can share one Meta app with different products
added, but they stay separate entries here so you can enable them one at a
time. Give each its own credentials even if the values repeat.

### Order worth doing them in

1. **Threads** — smallest review surface, and the flow is already proven.
2. **Instagram** — biggest creator value. Same Meta app, more review.
3. **Facebook Pages** — mostly free once Instagram is approved.
4. **Pinterest** — starts in trial access; standard access needs a request.
5. **Reddit** — no formal review, but respect the API terms and rate limits.

## Verify the registry against live docs

`src/lib/oauth.ts` carries each platform's authorize URL, token URL and scopes.
Those were written without a live app to test against, so **check each one
against the provider's current docs as you register** — API versions and scope
names change often, and a wrong scope fails at consent time with a message the
creator can't act on.

The ones most likely to have moved:

- Meta Graph API version in the Facebook `authorizeUrl` / `tokenUrl`
- Instagram scope names (`instagram_business_*` vs the older `instagram_*`)
- Pinterest's token endpoint path

## After adding credentials

Add the pair to `/srv/ensemble/.env`, then:

```sh
sudo systemctl restart ensemble
```

The connect button for that platform switches itself on — no code change. Then
connect your own account first and confirm the capability probe reports
"Auto-posting is ready" before offering it to anyone else.
