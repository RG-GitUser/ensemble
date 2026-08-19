import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getLeads, getSiteByUser, getSocialAccounts } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { IntegrationsForm } from "@/components/IntegrationsForm";
import { LockedOverlay } from "@/components/LockedOverlay";
import { SocialIntegrations } from "@/components/SocialDashboard";
import { OAuthNotice } from "@/components/OAuthNotice";

function LockedCard({ title, body, plan }: { title: string; body: string; plan: string }) {
  return (
    <div className="card border-dashed opacity-75">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">{title}</h2>
        <span className="rounded-full bg-warn/15 px-2.5 py-1 text-[10px] font-bold uppercase text-warn">{plan}</span>
      </div>
      <p className="mt-1 text-sm text-mist">{body}</p>
      <Link href="/dashboard/settings" className="btn-ghost mt-4 !py-2 text-sm">Upgrade in Settings</Link>
    </div>
  );
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ oauth?: string; platform?: string }>;
}) {
  const user = await requireUser();
  const site = getSiteByUser(user.id);
  if (!site) redirect("/dashboard");
  const plan = getPlan(site.plan);
  const leads = plan.newsletter ? getLeads(site.id) : [];
  const { oauth, platform } = await searchParams;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
      <p className="mt-1 text-sm text-mist">Connect the tools that power your page. Available integrations depend on your plan.</p>

      <div className="mt-6 space-y-5">
        <OAuthNotice code={oauth} platform={platform} />
        {(() => {
          const social = (
            <SocialIntegrations
              accounts={getSocialAccounts(site.id)}
              twitchChannel={site.config.twitchChannel ?? ""}
              facebookLiveUrl={site.config.facebookLiveUrl ?? ""}
              instagramLiveUser={site.config.instagramLiveUser ?? ""}
              streamKeys={{
                twitch: site.config.twitchStreamKey ?? "",
                facebook: site.config.facebookStreamKey ?? "",
                instagram: site.config.instagramStreamKey ?? "",
              }}
              liveNow={site.config.liveNow === true}
              ingestKey={site.embedToken}
              threadsOAuthReady={!!process.env.THREADS_APP_ID && !!process.env.THREADS_APP_SECRET}
              showLive={plan.live}
            />
          );
          return plan.social ? social : <LockedOverlay plan="Pro">{social}</LockedOverlay>;
        })()}
        {!plan.live && (
          <LockedCard
            title="Live streams & simulcast"
            body="Link Twitch, Facebook and Instagram Live, show the players on your page, and go live everywhere with one click."
            plan="Enterprise"
          />
        )}

        <IntegrationsForm
          payments={plan.payments}
          calendar={plan.calendar}
          chatroom={plan.chatroom}
          newsletter={plan.newsletter}
          stripeKey={site.config.stripeKey ?? ""}
          calendlyUrl={site.config.calendlyUrl ?? ""}
          chatroomEnabled={site.config.chatroomEnabled ?? true}
          newsletterEnabled={site.config.newsletterEnabled ?? true}
        />

        {!plan.payments && (
          <LockedCard
            title="Stripe payments"
            body="Sell merch directly from your page with Stripe payment links."
            plan="Pro"
          />
        )}
        {!plan.calendar && (
          <LockedCard
            title="Calendar"
            body="Embed Calendly or Cal.com for events, meet & greets and bookings."
            plan="Enterprise"
          />
        )}
        {!plan.chatroom && (
          <LockedCard
            title="Community chatroom"
            body="A custom chat space for your followers, right on your page."
            plan="Enterprise"
          />
        )}
        {!plan.newsletter && (
          <LockedCard
            title="Newsletter / memberships"
            body="Collect subscriber emails and build your membership list."
            plan="Enterprise"
          />
        )}

        {plan.newsletter && (
          <div className="card">
            <h2 className="font-bold">Subscribers ({leads.length})</h2>
            {leads.length === 0 ? (
              <p className="mt-2 text-sm text-mist">
                No signups yet — add a Newsletter section to your page and publish it.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-edge text-sm">
                {leads.map((l) => (
                  <li key={l.id} className="flex justify-between py-2">
                    <span>{l.email}</span>
                    <span className="text-mist">{l.createdAt.slice(0, 10)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {plan.helpdesk && (
          <div className="card border-good/40">
            <h2 className="font-bold">Help desk support</h2>
            <p className="mt-1 text-sm text-mist">
              Enterprise includes priority support. Email{" "}
              <a href="mailto:rileyg0035@gmail.com" className="text-brand hover:underline">rileyg0035@gmail.com</a> and you&apos;ll hear back
              first.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
