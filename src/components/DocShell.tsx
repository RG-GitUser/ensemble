import Link from "next/link";

/**
 * Shared frame for the public document pages (/privacy, /terms, /documents).
 * A slim header back to the site, a readable column, and a legal footer, so
 * the three pages stay visually one family without repeating this markup.
 */
export function DocShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-edge/60">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight">
            En<span className="bg-gradient-to-r from-brand to-brand2 bg-clip-text text-transparent">semble</span>
          </Link>
          <nav className="flex gap-4 text-sm text-mist">
            <Link href="/documents" className="transition hover:text-snow">Documents</Link>
            <Link href="/login" className="transition hover:text-snow">Log in</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">{children}</main>

      <footer className="border-t border-edge/60">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-6 py-6 text-sm text-mist sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Ensemble. Ensemble and the Ensemble wordmark are trademarks of their owner.</p>
          <p className="flex gap-4">
            <Link href="/privacy" className="transition hover:text-snow">Privacy</Link>
            <Link href="/terms" className="transition hover:text-snow">Terms</Link>
            <Link href="/documents" className="transition hover:text-snow">Documents</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}

/** One titled block of document copy. */
export function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-mist">{children}</div>
    </section>
  );
}
