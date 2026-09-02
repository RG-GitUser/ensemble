import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string; recovered?: string }> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  // Set by the reset flow on its way here, so a new password lands on a page
  // that acknowledges it rather than a bare login form.
  const { reset, recovered } = await searchParams;
  return (
    <div className="glow flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center text-lg font-bold tracking-tight">
          En<span className="bg-gradient-to-r from-brand to-brand2 bg-clip-text text-transparent">semble</span>
        </Link>
        <div className="card">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="mt-1 mb-6 text-sm text-mist">Log in to manage your page.</p>
          {recovered === "1" && (
            <p className="mb-4 rounded-xl border border-good/40 bg-good/10 px-4 py-2.5 text-sm text-snow">
              Your login address and password are set. Use them below.
            </p>
          )}
          {reset === "1" && (
            <p className="mb-4 rounded-xl border border-good/40 bg-good/10 px-4 py-2.5 text-sm text-snow">
              Your password is set. Log in with it below.
            </p>
          )}
          <AuthForm mode="login" />
          <p className="mt-4 text-center text-sm text-mist">
            <Link href="/forgot" className="font-semibold text-brand hover:underline">Forgot your password?</Link>
          </p>
        </div>
        <p className="mt-6 text-center text-sm text-mist">
          New here?{" "}
          <Link href="/signup" className="font-semibold text-brand hover:underline">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
