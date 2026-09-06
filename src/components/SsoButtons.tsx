import { LOGIN_PROVIDERS } from "@/lib/login-providers";

/**
 * "Continue with Google / Microsoft / Yahoo".
 *
 * Plain links, not a form: starting the flow is a GET to a route that sets a
 * state cookie and redirects, so there is nothing to submit and no client
 * JavaScript needed for it to work.
 *
 * `ready` comes from the server, and a provider with no credentials
 * configured is not rendered at all. A button that always leads to
 * "not configured" is worse than no button — it reads as broken software
 * rather than as a feature this install hasn't switched on.
 *
 * No brand marks: simple-icons carries Google but not Microsoft or Yahoo, and
 * a hand-drawn Microsoft logo would be subtly wrong on the one screen where
 * looking legitimate matters most. Uniform text is the honest version.
 */
export function SsoButtons({ ready, verb = "Continue" }: { ready: string[]; verb?: string }) {
  const providers = LOGIN_PROVIDERS.filter((p) => ready.includes(p.id));
  if (providers.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex flex-col gap-2">
        {providers.map((p) => (
          <a key={p.id} href={`/api/auth/${p.id}`} className="btn-ghost w-full justify-center !py-2.5 text-sm">
            {verb} with {p.name}
          </a>
        ))}
      </div>
      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-edge" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-mist">or</span>
        <span className="h-px flex-1 bg-edge" />
      </div>
    </div>
  );
}

/** What went wrong, in words the person can act on. */
export const SSO_ERRORS: Record<string, string> = {
  cancelled: "Sign-in was cancelled — nothing changed.",
  expired: "That sign-in link expired. Press the button again.",
  failed: "We couldn't complete that sign-in. Try again, or use your email and password.",
  "no-email":
    "That account didn't give us a verified email address, so we can't sign you in with it. Use your email and password instead.",
  "not-configured": "That sign-in method isn't available on this site yet.",
  "unknown-provider": "That sign-in method isn't available.",
  "rate-limited": "Too many sign-in attempts. Try again in a few minutes.",
  unavailable: "That account can't be signed into this way.",
};
