import Link from "next/link";
import type { Metadata } from "next";
import { DocSection, DocShell } from "@/components/DocShell";

export const metadata: Metadata = {
  title: "Documents — Ensemble",
  description: "Creator guides, developer docs and the legal pages, in one place.",
};

const TABS = [
  { id: "", label: "Creator guides" },
  { id: "instructions", label: "Instructions" },
  { id: "dev", label: "Developer docs" },
  { id: "legal", label: "Legal" },
];

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-edge bg-panel2 p-3 font-mono text-xs leading-relaxed text-snow">
      {children}
    </pre>
  );
}

function GuidesTab() {
  return (
    <>
      <DocSection title="Go live everywhere">
        <p>
          Stream once and Ensemble&apos;s relay sends it to Twitch, YouTube and Facebook at the same time. Any
          streaming app works — OBS or Streamlabs on desktop, Larix or PRISM on a phone; the examples below say OBS
          because it&apos;s the most common. The setup is two copy-and-pastes, done once, in opposite directions.
          Understanding the direction of each one makes the whole thing click.
        </p>
        <p>
          <span className="font-semibold text-snow">1. Tell your streaming app where to send your stream.</span> In
          the dashboard under Integrations, the green panel shows a Server address and a Key. Copy both into OBS
          under Settings, then Stream, with the service set to Custom (every other app has the same two fields).
          This key is issued by Ensemble and proves to us that the incoming stream is yours.
        </p>
        <p>
          <span className="font-semibold text-snow">2. Tell Ensemble where to push it.</span> Each platform gives its
          streamers a private stream key. Copy each one from the platform and paste it into the matching field in the
          dashboard. Twitch keeps it under Creator Dashboard, then Settings, then Stream. YouTube shows it in
          YouTube Studio after you choose Go live. Facebook shows it in Live Producer under Streaming software. A
          platform you leave blank is simply skipped.
        </p>
        <p>
          That&apos;s the whole setup. From then on, pressing Start Streaming in OBS is all it takes. Your page flips
          to on-air by itself within a few seconds, and flips back when you stop. The announcement post to your
          social accounts stays behind its own button in the dashboard, so a test stream never posts to your
          followers.
        </p>
        <p>
          <span className="font-semibold text-snow">When you&apos;d touch it again.</span> If you reset a key on a
          platform&apos;s side, paste the new one into the dashboard. If you press Replace key in Ensemble, update
          OBS with the new key. If one platform doesn&apos;t receive a stream while the others do, its saved key has
          almost always gone stale, and re-pasting a fresh one fixes it.
        </p>
        <p>
          Instagram Live is the one exception. Instagram offers no supported way for outside software to send it a
          live stream, so the relay doesn&apos;t push there. The Instagram player on your page still works.
        </p>
      </DocSection>

      <DocSection title="Post everywhere at once">
        <p>
          Connect your platforms under Integrations, then write once in Socials and the post goes to every connected
          account. Bluesky (with an app password) and Discord (with a channel webhook) publish for real today.
          Threads, Instagram, Facebook, Pinterest and Reddit publish with a one-click connection as Ensemble&apos;s
          platform credentials come online, and handle-only connections queue your posts until then, so nothing you
          write is lost.
        </p>
      </DocSection>

      <DocSection title="Track your growth">
        <p>
          The Growth tracker on the Socials page logs your follower counts on the dates they were true. Backfilling
          old milestones from screenshots is the point, so past dates are welcome, and shorthand like 10k or 1.2m
          works in the count field.
        </p>
      </DocSection>

      <DocSection title="Use your own domain">
        <p>
          Pro and Enterprise pages can live on a domain you own. The dashboard walks you through it under My
          Website, including the one DNS record that proves the domain is yours before anything goes live on it.
        </p>
      </DocSection>
    </>
  );
}

/** Numbered walkthrough steps, the instructional counterpart to the prose guides. */
function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="mt-2 space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm leading-relaxed text-mist">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-[11px] font-bold text-brand">
            {i + 1}
          </span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function InstructionsTab() {
  return (
    <>
      <p className="mt-6 text-sm text-mist">
        Exact click-by-click instructions for the common setups. Each one assumes you&apos;re logged in to the
        dashboard. If a step doesn&apos;t match what you see, email{" "}
        <a href="mailto:onboarding@ensemble.it.com" className="text-brand hover:underline">onboarding@ensemble.it.com</a>{" "}
        and a person will walk you through it.
      </p>

      <DocSection title="Publish your first page">
        <Steps
          items={[
            <>Open <span className="text-snow">Page Builder</span> and add the sections you want. Type straight into a section and press its save button.</>,
            <>Drag a section by its title bar to reorder the page.</>,
            <>Open the <span className="text-snow">Design</span> tab to pick colors, type and layout. Every design option is on every plan.</>,
            <>Back on <span className="text-snow">Overview</span>, press <span className="text-snow">Publish</span>. Your page is live at your Ensemble address, and you can unpublish any time without losing anything.</>,
          ]}
        />
      </DocSection>

      <DocSection title="Connect a social account">
        <Steps
          items={[
            <>Open <span className="text-snow">Integrations</span> and tap a platform tile in the Social media card.</>,
            <>Most platforms ask for your handle or profile link. Bluesky wants your handle plus an app password (create one under Bluesky&apos;s Settings, then Privacy, then App Passwords). Discord wants a channel webhook URL (Server Settings, then Integrations, then Webhooks).</>,
            <>Press <span className="text-snow">Connect</span>. The tile turns green, and posts from the Socials page now include this platform.</>,
            <>To remove one later, tap its tile and press <span className="text-snow">Disconnect</span>. Stored credentials are deleted immediately.</>,
          ]}
        />
      </DocSection>

      <DocSection title="Set up simulcast streaming">
        <Steps
          items={[
            <>On <span className="text-snow">Integrations</span>, find the green <span className="text-snow">Stream once, reach everywhere</span> panel (Enterprise plan). Any streaming app works — these steps use OBS; on a phone, Larix Broadcaster takes the same server and key.</>,
            <>Open OBS on your computer. Go to File, then Settings, then the <span className="text-snow">Stream</span> tab, and set Service to <span className="text-snow">Custom</span>.</>,
            <>Copy the panel&apos;s <span className="text-snow">Server</span> into OBS&apos;s Server field, and the panel&apos;s <span className="text-snow">Key</span> into OBS&apos;s Stream Key field. Press OK. This part never changes again.</>,
            <>Get each platform&apos;s stream key. Twitch: Creator Dashboard, then Settings, then Stream. YouTube: YouTube Studio, then Go live, then Stream settings. Facebook: Live Producer, under Streaming software.</>,
            <>Paste each key into its field under <span className="text-snow">Stream keys</span> and press <span className="text-snow">Save live setup</span>. A platform you leave blank is skipped.</>,
            <>Press <span className="text-snow">Start Streaming</span> in OBS. Your page shows on-air within seconds and every platform with a saved key receives the stream. Press <span className="text-snow">Announce I&apos;m live</span> when you want your followers told.</>,
            <>Stop streaming in OBS when you&apos;re done. The badge drops and every platform ends its broadcast on its own.</>,
          ]}
        />
      </DocSection>

      <DocSection title="Post to every platform at once">
        <Steps
          items={[
            <>Open <span className="text-snow">Socials</span> and write your post. Add a media link if the post has one.</>,
            <>Press <span className="text-snow">Post everywhere</span>. The post goes to every connected account, and the Activity Feed below shows per-platform delivery.</>,
            <>A failed or queued platform shows a <span className="text-snow">Retry</span> button on the post. Queued means the platform is waiting on its one-click connection coming online, and the post sends when it does.</>,
          ]}
        />
      </DocSection>

      <DocSection title="Log your follower growth">
        <Steps
          items={[
            <>On <span className="text-snow">Socials</span>, find the <span className="text-snow">Growth tracker</span> card.</>,
            <>Pick a platform, pick the date the count was true (past dates are the point), and type the count. 10000, 10,000 and 10k all work.</>,
            <>Press <span className="text-snow">Add</span>. Entries chart themselves per platform, and re-entering the same date replaces that entry, so a typo is one re-entry away.</>,
          ]}
        />
      </DocSection>

      <DocSection title="Connect your own domain">
        <Steps
          items={[
            <>Open <span className="text-snow">My Website</span> and enter your domain under the domain card (Pro and Enterprise).</>,
            <>Add the TXT record the dashboard shows you at your domain registrar. This proves the domain is yours, and nothing goes live on it until it does.</>,
            <>Press verify in the dashboard once the record is in place. DNS can take a few minutes to propagate.</>,
            <>Add the A or CNAME record the dashboard shows you. When it takes effect, your page serves on your domain with its own certificate.</>,
          ]}
        />
      </DocSection>

      <DocSection title="Put your page inside an existing website">
        <Steps
          items={[
            <>Open <span className="text-snow">My Website</span> and copy the embed snippet.</>,
            <>Paste it into your site&apos;s HTML where the content should appear.</>,
            <>Publish your site. The embed renders your Ensemble sections inline and follows every edit you make from the dashboard.</>,
          ]}
        />
      </DocSection>
    </>
  );
}

function DevTab() {
  return (
    <>
      <DocSection title="The embed">
        <p>
          Any website can render an Ensemble page&apos;s sections inline with one script tag. The token is on the
          dashboard&apos;s My Website tab, and unpublishing your page takes the embed down everywhere at once.
        </p>
        <Code>{`<div data-ensemble></div>\n<script src="https://ensemble.it.com/embed.js" data-token="YOUR_EMBED_TOKEN" defer></script>`}</Code>
      </DocSection>

      <DocSection title="Content API">
        <p>
          The embed is powered by a public JSON endpoint. It serves published sites only and allows cross-origin
          reads.
        </p>
        <Code>{`GET https://ensemble.it.com/api/content/{embedToken}\n→ 200 { site, sections, ... }  |  404 unknown, draft or unpaid`}</Code>
      </DocSection>

      <DocSection title="Live relay endpoints">
        <p>
          The simulcast relay is MediaMTX plus ffmpeg talking to three endpoints. They exist for the relay itself,
          and are documented here for anyone operating their own deployment. The setup lives in DEPLOY.md section 10
          of the repository.
        </p>
        <Code>{`POST /api/live/auth      MediaMTX connection check (publish needs a valid ingest key;\n                         playback is loopback-only for the ffmpeg forwarders)\nGET  /api/live/targets   ?key={ingestKey} + x-live-secret header → push URLs\nPOST /api/live/status    {key, live} + x-live-secret header → flips the on-air badge`}</Code>
      </DocSection>

      <DocSection title="OAuth redirect URIs">
        <p>
          Operators registering their own platform apps point every callback at the same shape, with the platform
          name filled in.
        </p>
        <Code>{`https://ensemble.it.com/api/oauth/{platform}/callback`}</Code>
      </DocSection>

      <DocSection title="What doesn't exist yet">
        <p>
          There is no general REST API for creating posts or editing pages from outside the dashboard, and no
          webhooks for events. If you&apos;d build on either,{" "}
          <a href="mailto:support@ensemble.it.com" className="text-brand hover:underline">tell us what you need</a>.
        </p>
      </DocSection>
    </>
  );
}

function LegalTab() {
  return (
    <>
      <DocSection title="The legal pages">
        <p>
          <Link href="/privacy" className="text-brand hover:underline">Privacy</Link> covers what we store, what we
          never do with it, and how to have your data deleted.{" "}
          <Link href="/terms" className="text-brand hover:underline">Terms of service</Link> covers the rules of
          using Ensemble, billing, and whose content is whose.
        </p>
      </DocSection>
      <DocSection title="Trademark">
        <p>
          Ensemble and the Ensemble wordmark are trademarks of their owner. Creator pages are made by their creators,
          and a page living on ensemble.it.com doesn&apos;t mean Ensemble wrote or endorsed it.
        </p>
      </DocSection>
    </>
  );
}

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const active = TABS.some((t) => t.id === tab) ? (tab ?? "") : "";

  return (
    <DocShell>
      <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
      <p className="mt-2 text-sm text-mist">
        How the moving parts work, for creators and for people building around Ensemble.
      </p>

      <div className="mt-6 flex gap-2 border-b border-edge">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id ? `/documents?tab=${t.id}` : "/documents"}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${
              active === t.id ? "border-brand text-snow" : "border-transparent text-mist hover:text-snow"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {active === "dev" ? (
        <DevTab />
      ) : active === "legal" ? (
        <LegalTab />
      ) : active === "instructions" ? (
        <InstructionsTab />
      ) : (
        <GuidesTab />
      )}
    </DocShell>
  );
}
