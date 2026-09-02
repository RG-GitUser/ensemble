import Link from "next/link";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { getCurrentUser } from "@/lib/auth";
import { getAuthToken } from "@/lib/db";

/**
 * Choose a new password.
 *
 * The token is checked here so a dead link says so immediately rather than
 * after someone has typed a password twice. It is checked again inside the
 * action, which is the check that counts — this one is only courtesy, since
 * the link could expire between the page rendering and the form posting.
 */
export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { token } = await params;
  const user = getAuthToken(token, "password_reset")?.user ?? null;

  return (
    <div className="glow flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center text-lg font-bold tracking-tight">
          En<span className="bg-gradient-to-r from-brand to-brand2 bg-clip-text text-transparent">semble</span>
        </Link>
        <div className="card">
          {user ? (
            <>
              <h1 className="text-2xl font-bold">Choose a new password</h1>
              <p className="mt-1 mb-6 text-sm text-mist">
                For <span className="font-semibold text-snow">{user.email}</span>.
              </p>
              <ResetPasswordForm token={token} />
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">That link has expired</h1>
              <p className="mt-1 mb-6 text-sm text-mist">
                Reset links work once and last 45 minutes. Ask for a fresh one and it&apos;ll be along shortly.
              </p>
              <Link href="/forgot" className="btn-primary block w-full text-center">
                Send me a new link
              </Link>
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
