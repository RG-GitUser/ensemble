import Link from "next/link";
import { redirect } from "next/navigation";
import { RecoverLoginForm } from "@/components/RecoverLoginForm";
import { getCurrentUser } from "@/lib/auth";
import { getAuthToken } from "@/lib/db";

export default async function RecoverTokenPage({ params }: { params: Promise<{ token: string }> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { token } = await params;
  const pending = getAuthToken(token, "recover_login");

  return (
    <div className="glow flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center text-lg font-bold tracking-tight">
          En<span className="bg-gradient-to-r from-brand to-brand2 bg-clip-text text-transparent">semble</span>
        </Link>
        <div className="card">
          {pending ? (
            <>
              <h1 className="text-2xl font-bold">Set a new login</h1>
              {/* The address they could not remember is shown, because seeing it
                  is often the whole problem — plenty of people will recognise
                  it and want to keep it rather than change it. */}
              <p className="mt-1 mb-6 text-sm text-mist">
                This account currently logs in with{" "}
                <span className="font-semibold text-snow">{pending.user.email}</span>. Keep it or replace it, and choose
                a new password.
              </p>
              <RecoverLoginForm token={token} currentEmail={pending.user.email} />
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">That link has expired</h1>
              <p className="mt-1 mb-6 text-sm text-mist">
                Recovery links work once and last 45 minutes. Ask for a fresh one and it&apos;ll be along shortly.
              </p>
              <Link href="/recover" className="btn-primary block w-full text-center">Send me a new link</Link>
            </>
          )}
        </div>
        <p className="mt-6 text-center text-sm text-mist">
          <Link href="/login" className="font-semibold text-brand hover:underline">Back to log in</Link>
        </p>
      </div>
    </div>
  );
}
