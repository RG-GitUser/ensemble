import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getConnection, getSiteByUser, getSiteContent } from "@/lib/db";
import { disconnectWebsite, regenerateEmbedTokenAction, saveWebsiteContent, toggleConnection } from "@/lib/actions";
import { ConnectWebsiteForm, RescanButton } from "@/components/ConnectWebsiteForm";
import { CopyButton } from "@/components/CopyButton";
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

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
  const snippet = `<script src="${origin}/connect.js" data-site="${site.embedToken}" async></script>`;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight">My Website</h1>
      <p className="mt-1 text-sm text-mist">
        Pair your existing website with Ensemble — the dashboard loads your site&apos;s content, you edit it here, and
        the changes appear on your site. Your layout and design stay exactly as they are.
      </p>

      {!connection ? (
        <div className="card mt-6">
          <h2 className="font-bold">Step 1 — Load your website</h2>
          <p className="mt-1 text-sm text-mist">
            Enter your website&apos;s address. We&apos;ll scan the page and pull in every headline, paragraph, image and
            video so you can edit them from here.
          </p>
          <ConnectWebsiteForm />
        </div>
      ) : (
        <>
          <div className="card mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold">Paired website</h2>
                <p className="mt-1 text-sm">
                  <a href={connection.url} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                    {connection.url}
                  </a>
                </p>
                <p className="mt-1 text-xs text-mist">
                  {connection.lastSeen
                    ? `Snippet active — last seen ${connection.lastSeen.slice(0, 16).replace("T", " ")} UTC${connection.seenHost ? ` on ${connection.seenHost}` : ""}`
                    : "Waiting for your website to load the snippet below…"}
                  {" · "}
                  {connection.enabled ? "edits are live" : "paused — your site shows its original content"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <RescanButton />
                <form action={toggleConnection}>
                  <button className="btn-ghost !py-2 text-sm">{connection.enabled ? "Pause" : "Resume"}</button>
                </form>
                <form action={disconnectWebsite}>
                  <button className="btn-ghost !py-2 text-sm !text-brand2">Disconnect</button>
                </form>
              </div>
            </div>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-mist hover:text-snow">Change website address</summary>
              <ConnectWebsiteForm initialUrl={connection.url} />
            </details>
          </div>

          <div className="card mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold">Step 2 — Paste your pairing snippet</h2>
              <CopyButton text={snippet} label="Copy snippet" />
            </div>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-panel2 p-4 font-mono text-xs leading-relaxed text-snow">
              {snippet}
            </pre>
            <p className="mt-3 text-sm text-mist">
              One line, once — in your site&apos;s HTML, right before{" "}
              <span className="font-mono text-snow">&lt;/body&gt;</span> (WordPress: a Custom HTML block or footer
              scripts box; cPanel: edit the page in File Manager). It carries your private pairing key, which is why
              it&apos;s more than just a link — only snippets with your key receive your edits, and you can reset the
              key below at any time.
            </p>
          </div>

          <div className="card mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold">Step 3 — Edit your content</h2>
                <p className="mt-1 text-sm text-mist">
                  {content.length} editable pieces found · {editedCount} edited. Leave a field untouched (or restore its
                  original text) to keep what your site already has.
                </p>
              </div>
            </div>
            <form action={saveWebsiteContent} className="mt-5 space-y-5">
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
          </div>

          <div className="card mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold">Reset your pairing key</h2>
                <p className="mt-1 text-sm text-mist">
                  Generates a new key and disables the old one — update the snippet on your site afterwards.
                </p>
              </div>
              <form action={regenerateEmbedTokenAction}>
                <button className="btn-ghost !py-2 text-sm">Reset key</button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
