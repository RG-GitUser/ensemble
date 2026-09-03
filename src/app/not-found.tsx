import Link from "next/link";

/**
 * Shown for every notFound() in the app — a slug nobody has taken, an unknown
 * custom domain, a spent link. Deliberately says nothing about whether the
 * thing exists but is hidden, which is what the reserved-slug and draft-page
 * checks rely on.
 */
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-mist">
        There&apos;s nothing at this address.
      </p>
      <Link href="/" className="btn-primary mt-6 !py-2 text-sm">
        Go to the homepage
      </Link>
    </main>
  );
}
