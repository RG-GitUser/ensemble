import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <div className="glow flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center text-lg font-bold tracking-tight">
          Social<span className="bg-gradient-to-r from-brand to-brand2 bg-clip-text text-transparent">Construct</span>
        </Link>
        <div className="card">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="mt-1 mb-6 text-sm text-mist">Log in to manage your page.</p>
          <AuthForm mode="login" />
        </div>
        <p className="mt-6 text-center text-sm text-mist">
          New here?{" "}
          <Link href="/signup" className="font-semibold text-brand hover:underline">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
