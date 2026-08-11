import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { billingOk } from "@/lib/billing";
import { getConnection, getDomainBySite, getSiteByUser, getSiteContent } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { disconnectWebsite, regenerateEmbedTokenAction, resyncWebsite, saveWebsiteContent, toggleConnection } from "@/lib/actions";
import { DomainSetup } from "@/components/DomainSetup";
import { FreeAddressCard } from "@/components/FreeAddressCard";
import { SnippetInstaller } from "@/components/SnippetInstaller";
import { StepCard } from "@/components/StepCard";
import type { ContentItem } from "@/lib/types";

function itemLabel(item: ContentItem): string {
  const tag = item.selector.split(" > ").pop()?.split(":")[0] ?? "";
  const names: Record<string, string> = {
    h1: "Heading",
    h2: "Heading",
    h3: "Heading",
    h4: "Heading",
    h5: "Heading",
    h6: "Heading",
    p: "Paragraph",
    li: "List item",
    blockquote: "Quote",
    figcaption: "Caption",
    img: "Image",
    iframe: "Video / embed",
    video: "Video",
  };
  return names[tag] ?? tag.toUpperCase();
}

export default async function ConnectPage() {
  const user = await requireUser();
  const site = getSiteByUser(user.id);
  if (!site) redirect("/dashboard");

  const connection = getConnection(site.id);
  const content = connection ? getSiteContent(site.id) : [];
  const editedCount = content.filter((c) => c.edited !== null).length;
  const domain = getDomainBySite(site.id);

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
  // Public-facing links prefer the configured canonical URL over the request
  // host, so a page shared from a preview host still shows the real address.
  const appOrigin = (process.env.APP_URL || origin).replace(/\/$/, "");
  // The snippet runs on someone else's website, so it must point at our public
  // origin — never the host the dashboard happens to be open on. Copying a
  // localhost URL onto a live site fails twice over: visitors can't resolve it,
  // and an http src on an https page is blocked as mixed content.
  const snippet = `<script src="${appOrigin}/connect.js" data-site="${site.embedToken}" async></script>`;
  const snippetIsLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$)/i.test(appOrigin);

  // Step state. Pasting the snippet is the only manual action — everything
  // after it ticks itself off as the snippet reports in.
  const snippetSeen = !!connection?.lastSeen;
  const contentFound = content.length > 0;
  const awaitingReport = snippetSeen && !contentFound;
  const done = [snippetSeen, contentFound, editedCount > 0].filter(Boolean).length;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight">My Website</h1>
      <p className="mt-1 text-sm text-mist">
        Pair the website you already have with Ensemble — you edit its words and pictures from here, and your site
        updates itself. Your layout and design stay exactly as they are.
      </p>

      {/* ── Pair an existing site ───────────────────────────────── */}
      <div className="mt-8 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight">Connect your website</h2>
        <span className={`text-xs font-semibold ${done === 3 ? "text-good" : "text-mist"}`}>
          {done} of 3 done
        </span>
      </div>

      <div className="mt-4 space-y-4">
        <StepCard
          n={1}
          done={snippetSeen}
          title="Paste one line into your website"
          summary={
            snippetSeen
              ? `Connected${connection?.seenHost ? ` — seen on ${connection.seenHost}` : ""}`
              : "This is the only setup step. Everything else happens by itself."
          }
        >
          <SnippetInstaller snippet={snippet} siteUrl={connection?.url} showChecker={!snippetSeen && !snippetIsLocal} />
          <p className="mt-3 text-xs text-mist/70">
            The line carries your private pairing key, which is why it&apos;s more than just a link — only snippets
            with your key receive your edits.
          </p>
          {snippetIsLocal && (
            <p className="mt-3 rounded-xl border border-brand2/40 bg-brand2/10 px-4 py-2.5 text-xs text-brand2">
              <span className="font-semibold">This snippet only works on this machine.</span> It points at{" "}
              <span className="font-mono">{appOrigin}</span>, which nobody else can reach — and an{" "}
              <span className="font-mono">http://</span> script is blocked outright on an https site. Set{" "}
              <span className="font-mono">APP_URL</span> to your public address and copy it again before pasting it
              into a real website.
            </p>
          )}

        </StepCard>

        <StepCard
          n={2}
          done={contentFound}
          title="We read your page"
          summary={
            contentFound
              ? `${content.length} editable pieces found`
              : awaitingReport
                ? "Reading your page…"
                : "Happens automatically once step 1 is done"
          }
        >
          {contentFound ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-mist">
                We found <span className="font-semibold text-snow">{content.length}</span> headings, paragraphs, images
                and videos you can edit. Changed your site since? Re-sync and we&apos;ll read it again next time it
                loads — your edits are kept.
              </p>
              <form action={resyncWebsite}>
                <button className="btn-ghost !py-2 text-sm">Re-sync content</button>
              </form>
            </div>
          ) : awaitingReport ? (
            <p className="text-sm text-mist">
              Your snippet is live and we&apos;ve asked it for the page contents. Open your website once more, then
              refresh this page — it usually takes a couple of seconds.
            </p>
          ) : (
            <p className="text-sm text-mist">
              Nothing to do here. As soon as your snippet loads, it reads the page from inside your own browser and
              sends us the list — that works even on sites behind Cloudflare or built with JavaScript.
            </p>
          )}
        </StepCard>

        <StepCard
          n={3}
          done={editedCount > 0}
          title="Edit your content"
          summary={
            !contentFound
              ? "Unlocks after step 2"
              : editedCount > 0
                ? `${editedCount} of ${content.length} edited · changes are live`
                : "Ready — change anything below"
          }
        >
          {!contentFound ? (
            <p className="text-sm text-mist">Your website&apos;s text and images will appear here to edit.</p>
          ) : (
            <>
              <p className="text-sm text-mist">
                Leave a field untouched — or restore its original text — to keep what your site already has.
              </p>
              <form action={saveWebsiteContent} className="mt-4 space-y-4">
                {content.map((item) => (
                  <div key={item.id} className="rounded-xl border border-edge bg-panel2 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-xs font-semibold uppercase tracking-wide text-mist">
                        {itemLabel(item)}
                      </label>
                      {item.edited !== null && (
                        <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold uppercase text-brand">
                          edited
                        </span>
                      )}
                    </div>
                    {item.kind === "text" ? (
                      <textarea
                        name={`content_${item.id}`}
                        defaultValue={item.edited ?? item.original}
                        className="field mt-2 min-h-16 text-sm"
                      />
                    ) : (
                      <>
                        {item.kind === "image" && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.edited ?? item.original}
                            alt=""
                            className="mt-2 h-24 w-24 rounded-lg border border-edge object-cover"
                          />
                        )}
                        <input
                          name={`content_${item.id}`}
                          defaultValue={item.edited ?? item.original}
                          className="field mt-2 font-mono text-xs"
                          placeholder="https://…"
                        />
                      </>
                    )}
                    {item.edited !== null && (
                      <p className="mt-2 truncate text-xs text-mist" title={item.original}>
                        Original: {item.original}
                      </p>
                    )}
                  </div>
                ))}
                <button className="btn-primary !py-2 text-sm">Save changes</button>
              </form>
              <p className="mt-4 text-xs text-mist/70">
                Text edits replace the whole block as plain text — links or bold styling inside an edited block are
                flattened. Paste a YouTube/Vimeo watch URL into a video field and it converts automatically.
              </p>
            </>
          )}
        </StepCard>
      </div>

      {connection && (
        <div className="card mt-4 !bg-panel/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                Paired with{" "}
                <a href={connection.url} target="_blank" rel="noreferrer" className="break-all text-brand hover:underline">
                  {connection.url || "your website"}
                </a>
              </p>
              <p className="mt-0.5 text-xs text-mist">
                {connection.lastSeen
                  ? `Last seen ${connection.lastSeen.slice(0, 16).replace("T", " ")} UTC`
                  : "Not seen yet"}
                {" · "}
                {connection.enabled ? "your edits are showing" : "paused — your site shows its original content"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <form action={toggleConnection}>
                <button className="btn-ghost !py-2 text-sm">{connection.enabled ? "Pause edits" : "Resume edits"}</button>
              </form>
              <form action={regenerateEmbedTokenAction}>
                <button className="btn-ghost !py-2 text-sm" title="Issues a new key and disables the old one — update the snippet on your site afterwards">
                  Reset key
                </button>
              </form>
              <form action={disconnectWebsite}>
                <button className="btn-ghost !py-2 text-sm !text-brand2">Disconnect</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Where the hosted page lives ─────────────────────────── */}
      <div className="mt-12">
        <h2 className="text-lg font-bold tracking-tight">Your page address</h2>
        <p className="mt-1 text-sm text-mist">
          Two ways to be reachable — use the address we give you, or bring your own domain.
        </p>
      </div>

      <div className="mt-4 space-y-6">
        <FreeAddressCard
          slug={site.slug}
          tagline={site.config.tagline}
          origin={appOrigin}
          published={site.published}
          billingReady={billingOk(site)}
        />

        <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-mist/50">
          <span className="h-px flex-1 bg-edge" />
          or bring your own
          <span className="h-px flex-1 bg-edge" />
        </div>

        <DomainSetup
          hostname={domain?.hostname ?? ""}
          lastSeen={domain?.lastSeen ?? null}
          published={site.published}
          billingReady={billingOk(site)}
          allowed={getPlan(site.plan).customDomain}
          aRecord={process.env.DOMAIN_A_RECORD || null}
          cnameTarget={process.env.DOMAIN_CNAME_TARGET || null}
        />
      </div>
    </div>
  );
}
