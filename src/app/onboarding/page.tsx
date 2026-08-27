import { redirect } from "next/navigation";
import { Onboarding } from "@/components/Onboarding";
import { logout } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { getSiteByUser } from "@/lib/db";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; path?: string }>;
}) {
  const user = await requireUser();
  if (getSiteByUser(user.id)) redirect("/dashboard");
  const { plan, path } = await searchParams;

  return (
    <div className="glow flex flex-1 flex-col items-center px-6 py-16">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Welcome, {user.name.split(" ")[0]}</h1>
        <p className="mt-2 text-mist">How do you want to set up {user.businessName}?</p>
      </div>
      <Onboarding initialPath={path} initialPlan={plan} />
      <p className="mt-8 text-sm text-mist">
        Not sure which way to go?{" "}
        <a href="mailto:onboarding@ensemble.it.com" className="text-brand hover:underline">
          onboarding@ensemble.it.com
        </a>{" "}
        answers fast while you&apos;re getting set up.
      </p>
      <form action={logout} className="mt-6">
        <button className="text-sm text-mist transition hover:text-snow">← Sign out</button>
      </form>
    </div>
  );
}
