import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; path?: string }>;
}) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { plan, path } = await searchParams;
  return (
    <div className="glow flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center text-lg font-bold tracking-tight">
          Social<span className="bg-gradient-to-r from-brand to-brand2 bg-clip-text text-transparent">Construct</span>
        </Link>
        <div className="card">
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="mt-1 mb-6 text-sm text-mist">
            {path === "integrate"
              ? "Next step: tell us about your current website so we can quote the integration."
              : "Your page is a few pastes away."}
          </p>
          <AuthForm mode="signup" intentPlan={plan} intentPath={path} />
        </div>
        <p className="mt-6 text-center text-sm text-mist">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
