import Link from "next/link";
import { redirect } from "next/navigation";
import { RecoverRequestForm } from "@/components/RecoverRequestForm";
import { getCurrentUser } from "@/lib/auth";
import { mailEnabled } from "@/lib/mailer";

export default async function RecoverPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <div className="glow flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center text-lg font-bold tracking-tight">
          En<span className="bg-gradient-to-r from-brand to-brand2 bg-clip-text text-transparent">semble</span>
        </Link>
        <div className="card">
          <h1 className="text-2xl font-bold">Forgot which email you used?</h1>
          <p className="mt-1 mb-6 text-sm text-mist">
            Put in your recovery address — the second inbox you confirmed on your account — and we&apos;ll send you a
            way back in.
          </p>
          {!mailEnabled() && (
            <p className="mb-4 rounded-xl border border-warn/40 bg-warn/10 px-4 py-2.5 text-sm text-warn">
              Email sending isn&apos;t switched on for this server, so nothing will arrive.
            </p>
          )}
          <RecoverRequestForm />
        </div>
        <p className="mt-6 text-center text-sm text-mist">
          Know your email but not your password?{" "}
          <Link href="/forgot" className="font-semibold text-brand hover:underline">Reset it instead</Link>
        </p>
      </div>
    </div>
  );
}
