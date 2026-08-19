import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSiteByUser, getSocialAccounts, getSocialPosts } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { LockedOverlay } from "@/components/LockedOverlay";
import { SocialsPanel } from "@/components/SocialDashboard";

export default async function SocialsPage() {
  const user = await requireUser();
  const site = getSiteByUser(user.id);
  if (!site) redirect("/dashboard");
  const plan = getPlan(site.plan);

  const panel = (
    <SocialsPanel accounts={getSocialAccounts(site.id)} posts={getSocialPosts(site.id)} />
  );

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight">Socials</h1>
      <p className="mt-1 text-sm text-mist">
        Post to every connected account at once, and watch the activity roll in.
      </p>
      <div className="mt-6 space-y-5">
        {plan.social ? panel : <LockedOverlay plan="Pro">{panel}</LockedOverlay>}
      </div>
    </div>
  );
}
