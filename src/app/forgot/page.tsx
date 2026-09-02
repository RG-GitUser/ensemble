import Link from "next/link";
import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";
import { getCurrentUser } from "@/lib/auth";
import { mailEnabled } from "@/lib/mailer";

export default async function ForgotPasswordPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <div className="glow flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center text-lg font-bold tracking-tight">
          En<span className="bg-gradient-to-r from-brand to-brand2 bg-clip-text text-transparent">semble</span>
        </Link>
        <div className="card">
          <h1 className="text-2xl font-bold">Forgot your password?</h1>
          <p className="mt-1 mb-6 text-sm text-mist">
            Put in the email you signed up with and we&apos;ll send you a link to choose a new one.
          </p>
          {/* Said plainly rather than letting the send silently do nothing.
              Without a mail provider the link can never arrive, and a
              confirmation that promises one would be a lie. */}
          {!mailEnabled() && (
            <p className="mb-4 rounded-xl border border-warn/40 bg-warn/10 px-4 py-2.5 text-sm text-warn">
              Email sending isn&apos;t switched on for this server, so the link won&apos;t arrive. An administrator can
              reset the password with scripts/set-admin-password.mjs.
            </p>
          )}
          <ForgotPasswordForm />
        </div>
        <p className="mt-6 text-center text-sm text-mist">
          Don&apos;t know which email you used?{" "}
          <Link href="/recover" className="font-semibold text-brand hover:underline">Recover with your backup address</Link>
        </p>
        <p className="mt-2 text-center text-sm text-mist">
          Remembered it?{" "}
          <Link href="/login" className="font-semibold text-brand hover:underline">Back to log in</Link>
        </p>
      </div>
    </div>
  );
}
