import { CONNECT_ERRORS, getOAuthProvider, type ConnectErrorCode } from "@/lib/oauth";

/**
 * Turns the `?oauth=` code the callback redirects with into something a person
 * can act on.
 *
 * Before this existed the routes redirected with codes like `token-failed` and
 * nothing rendered them at all — a failed connection looked identical to never
 * having clicked the button. Every outcome now says what happened and what to
 * do next.
 */
export function OAuthNotice({ code, platform }: { code?: string; platform?: string }) {
  if (!code) return null;
  const name = (platform && getOAuthProvider(platform)?.name) ?? "the platform";

  if (code === "connected") {
    return (
      <Banner tone="good" title={`${name} is connected`}>
        Auto-posting is ready — scheduled posts will go out to {name} automatically.
      </Banner>
    );
  }

  // Connected, but the platform won't accept posts yet. The most important
  // case in the whole flow: it looks like success and silently isn't.
  if (code === "connected-not-postable") {
    return (
      <Banner tone="warn" title={`${name} is connected, but we can't post yet`}>
        {CONNECT_ERRORS["not-postable"].reason} {CONNECT_ERRORS["not-postable"].fix} Your connection is saved, so once
        that&apos;s sorted just reconnect and you&apos;re done.
      </Banner>
    );
  }

  const known = CONNECT_ERRORS[code as ConnectErrorCode];
  if (!known) return null;
  return (
    <Banner tone="bad" title={`Couldn't connect ${name}`}>
      {known.reason} {known.fix}
    </Banner>
  );
}

function Banner({
  tone,
  title,
  children,
}: {
  tone: "good" | "warn" | "bad";
  title: string;
  children: React.ReactNode;
}) {
  const skin =
    tone === "good"
      ? "border-good/40 bg-good/5 text-good"
      : tone === "warn"
        ? "border-warn/40 bg-warn/5 text-warn"
        : "border-brand2/40 bg-brand2/5 text-brand2";
  return (
    <div className={`card ${skin.split(" ").slice(0, 2).join(" ")}`}>
      <p className={`font-semibold ${skin.split(" ")[2]}`}>{title}</p>
      <p className="mt-1 text-sm text-mist">{children}</p>
    </div>
  );
}
