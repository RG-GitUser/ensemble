import Link from "next/link";

/** The 404 a visitor gets for an unknown page, or an unpublished creator slug. */
export default function NotFound() {
  return (
    <div className="glow flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center text-lg font-bold tracking-tight">
          En<span className="bg-gradient-to-r from-brand to-brand2 bg-clip-text text-transparent">semble</span>
        </Link>
        <div className="card">
          <h1 className="text-2xl font-bold">Page not found</h1>
          <p className="mt-1 text-sm text-mist">
            There&apos;s nothing at this address. If you followed a link to a creator&apos;s page, it may not be
            published yet.
          </p>
          <Link href="/" className="btn-primary mt-6 block w-full text-center">
            Go to the homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
