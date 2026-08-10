/**
 * Full-page "work in progress" screen for the marketing site.
 *
 * Deliberately NOT a security control: it's markup, so devtools removes it in
 * two clicks, and /signup, /login and /dashboard are still reachable directly.
 * It stops casual visitors poking at an unfinished product. If real blocking
 * is needed, gate it at Caddy (basic auth) or refuse signups server-side.
 *
 * Switched on with WIP_MODE=1 in .env, so it goes on and off with a restart
 * rather than a deploy.
 */
export function wipEnabled(): boolean {
  return process.env.WIP_MODE === "1";
}

export function WipOverlay() {
  return (
    <div
      // Covers the viewport and swallows every click, so nothing underneath
      // can be interacted with by accident.
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-6 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Work in progress"
    >
      <div className="w-full max-w-2xl rounded-3xl border border-edge/80 bg-panel/80 p-10 text-center shadow-2xl sm:p-16">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Ensemble</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-6xl">Work In Progress</h1>
        <p className="mx-auto mt-5 max-w-md text-mist">
          We&apos;re still building. The site will be open shortly — thanks for your patience.
        </p>
      </div>
    </div>
  );
}
