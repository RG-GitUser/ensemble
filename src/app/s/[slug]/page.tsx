import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSections, getSiteBySlug } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { parseLines } from "@/lib/sections";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import type { PlanDef } from "@/lib/plans";
import type { Section, Site } from "@/lib/types";

function embedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

function SectionView({ section, site, plan }: { section: Section; site: Site; plan: PlanDef }) {
  const c = section.content;
  switch (section.type) {
    case "hero":
      return (
        <section className="px-6 pb-16 pt-24 text-center">
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight sm:text-6xl">{c.heading}</h1>
          {c.subheading && <p className="mx-auto mt-5 max-w-xl text-lg text-white/70">{c.subheading}</p>}
          {c.ctaLabel && (
            <a
              href={c.ctaUrl || "#"}
              className="mt-8 inline-block rounded-xl px-7 py-3 font-semibold text-white transition hover:opacity-90"
              style={{ background: "var(--site-accent)" }}
            >
              {c.ctaLabel}
            </a>
          )}
        </section>
      );
    case "about":
      return (
        <section className="mx-auto max-w-3xl px-6 py-14">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start">
            {c.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.imageUrl} alt={c.heading} className="h-36 w-36 shrink-0 rounded-2xl object-cover" />
            )}
            <div className="text-center sm:text-left">
              <h2 className="text-2xl font-bold">{c.heading}</h2>
              <p className="mt-3 whitespace-pre-line text-white/70">{c.body}</p>
            </div>
          </div>
        </section>
      );
    case "bonus": {
      const items = parseLines(c.items ?? "");
      return (
        <section id="content" className="mx-auto max-w-3xl px-6 py-14">
          <h2 className="text-center text-2xl font-bold">{c.heading}</h2>
          <div className="mt-8 space-y-4">
            {items.map(([title, desc, url], i) => (
              <a
                key={i}
                href={url || "#"}
                className="block rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-white/30"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">{title}</p>
                    {desc && <p className="mt-1 text-sm text-white/60">{desc}</p>}
                  </div>
                  <span className="text-white/40">→</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      );
    }
    case "video": {
      const src = embedUrl(c.videoUrl ?? "");
      return (
        <section className="mx-auto max-w-3xl px-6 py-14">
          <h2 className="text-center text-2xl font-bold">{c.heading}</h2>
          {src ? (
            <div className="mt-8 overflow-hidden rounded-2xl border border-white/10">
              <iframe src={src} className="aspect-video w-full" allowFullScreen title={c.heading} />
            </div>
          ) : (
            <p className="mt-6 text-center text-white/50">Video coming soon.</p>
          )}
        </section>
      );
    }
    case "links": {
      const items = parseLines(c.items ?? "");
      return (
        <section className="mx-auto max-w-md px-6 py-14">
          <h2 className="text-center text-2xl font-bold">{c.heading}</h2>
          <div className="mt-8 space-y-3">
            {items.map(([label, url], i) => (
              <a
                key={i}
                href={url || "#"}
                className="block rounded-xl border border-white/10 bg-white/5 px-5 py-3.5 text-center font-semibold transition hover:border-white/30"
              >
                {label}
              </a>
            ))}
          </div>
        </section>
      );
    }
    case "merch": {
      const items = parseLines(c.items ?? "");
      return (
        <section className="mx-auto max-w-4xl px-6 py-14">
          <h2 className="text-center text-2xl font-bold">{c.heading}</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(([name, price, img, buyUrl], i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={name} className="aspect-square w-full object-cover" />
                ) : (
                  <div className="flex aspect-[5/2] w-full items-center justify-center bg-white/5 text-4xl sm:aspect-square">🛍️</div>
                )}
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{name}</p>
                    <p className="text-white/70">{price}</p>
                  </div>
                  {plan.payments && buyUrl ? (
                    <a
                      href={buyUrl}
                      className="mt-3 block rounded-lg py-2 text-center text-sm font-semibold text-white transition hover:opacity-90"
                      style={{ background: "var(--site-accent)" }}
                    >
                      Buy now
                    </a>
                  ) : (
                    <p className="mt-3 rounded-lg border border-white/10 py-2 text-center text-sm text-white/50">
                      Available soon
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      );
    }
    case "newsletter": {
      if (!plan.newsletter || site.config.newsletterEnabled === false) return null;
      return (
        <section className="px-6 py-14">
          <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/5 px-6 py-12 text-center">
            <h2 className="text-2xl font-bold">{c.heading}</h2>
            {c.body && <p className="mx-auto mt-3 max-w-md text-white/70">{c.body}</p>}
            <NewsletterSignup siteId={site.id} buttonLabel={c.buttonLabel ?? "Subscribe"} />
          </div>
        </section>
      );
    }
    case "calendar": {
      if (!plan.calendar) return null;
      const url = c.calendarUrl || site.config.calendlyUrl || "";
      return (
        <section className="mx-auto max-w-3xl px-6 py-14 text-center">
          <h2 className="text-2xl font-bold">{c.heading}</h2>
          {c.body && <p className="mx-auto mt-3 max-w-md text-white/70">{c.body}</p>}
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-block rounded-xl px-7 py-3 font-semibold text-white transition hover:opacity-90"
              style={{ background: "var(--site-accent)" }}
            >
              📅 Open calendar
            </a>
          ) : (
            <p className="mt-6 text-white/50">Calendar link coming soon.</p>
          )}
        </section>
      );
    }
    case "chatroom": {
      if (!plan.chatroom || site.config.chatroomEnabled === false) return null;
      return (
        <section className="mx-auto max-w-2xl px-6 py-14">
          <h2 className="text-center text-2xl font-bold">{c.heading}</h2>
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-center text-sm text-white/60">{c.body}</p>
            <div className="mt-5 space-y-3">
              <div className="w-fit max-w-[80%] rounded-2xl rounded-bl-sm bg-white/10 px-4 py-2 text-sm">
                first! 🎉
              </div>
              <div
                className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-sm px-4 py-2 text-sm text-white"
                style={{ background: "var(--site-accent)" }}
              >
                welcome to the clubhouse 💜
              </div>
            </div>
            <p className="mt-5 text-center text-xs text-white/40">Members-only chat · sign in on launch day</p>
          </div>
        </section>
      );
    }
    case "contact":
      return (
        <section className="mx-auto max-w-2xl px-6 py-14 text-center">
          <h2 className="text-2xl font-bold">{c.heading}</h2>
          {c.body && <p className="mx-auto mt-3 max-w-md text-white/70">{c.body}</p>}
          {c.email && (
            <a
              href={`mailto:${c.email}`}
              className="mt-6 inline-block rounded-xl border border-white/15 px-7 py-3 font-semibold transition hover:border-white/40"
            >
              ✉️ {c.email}
            </a>
          )}
        </section>
      );
    default:
      return null;
  }
}

export default async function PublicSitePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const site = getSiteBySlug(slug);
  if (!site) notFound();

  const user = await getCurrentUser();
  const isOwner = user?.id === site.userId;

  if (!site.published && !(preview && isOwner)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <p className="text-5xl">🚧</p>
        <h1 className="mt-4 text-2xl font-bold">This page isn&apos;t live yet</h1>
        <p className="mt-2 text-mist">Check back soon.</p>
      </div>
    );
  }

  const plan = getPlan(site.plan);
  const sections = getSections(site.id);

  return (
    <div
      className="flex-1 text-white"
      style={
        {
          "--site-accent": site.config.themeColor,
          background: `radial-gradient(800px 400px at 50% -10%, ${site.config.themeColor}33, transparent 70%), #0a0812`,
        } as React.CSSProperties
      }
    >
      {isOwner && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-3 border-b border-white/10 bg-black/60 px-4 py-2 text-xs backdrop-blur">
          <span className={site.published ? "text-emerald-400" : "text-amber-400"}>
            {site.published ? "● Live" : "● Draft preview — only you can see this"}
          </span>
          <Link href="/dashboard/builder" className="font-semibold underline underline-offset-2">
            Edit page
          </Link>
        </div>
      )}
      {sections.map((s) => (
        <SectionView key={s.id} section={s} site={site} plan={plan} />
      ))}
      <footer className="border-t border-white/10 px-6 py-10 text-center text-sm text-white/40">
        {site.config.tagline && <p className="mb-2 text-white/60">{site.config.tagline}</p>}
        <p>
          Powered by{" "}
          <Link href="/" className="font-semibold text-white/60 hover:text-white">
            SocialConstruct
          </Link>
        </p>
      </footer>
    </div>
  );
}
