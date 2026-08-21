import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { billingOk } from "@/lib/billing";
import { getChatMessages, getSections, recordPageView } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { embedUrl, parseLines } from "@/lib/sections";
import { DEFAULT_LIGHT_TEXT_COLOR, DEFAULT_TEXT_COLOR, DEFAULT_TEXT_SIZE, getFont } from "@/lib/fonts";
import { borderVars, DEFAULT_LIGHT_BG, DEFAULT_LIGHT_CARD, DEFAULT_SIZE, edgeForLight, FULL_WIDTH_TYPES, getColorMode, getLayout, getTextAlign } from "@/lib/theme";
import { backdropCss, themeCss } from "@/lib/themes";
import { SiteModeToggle } from "@/components/SiteModeToggle";
import { ChatBox } from "@/components/ChatBox";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import type { PlanDef } from "@/lib/plans";
import type { ChatMessage, Section, Site } from "@/lib/types";

function SectionView({
  section,
  site,
  plan,
  chat,
  host,
  appUrl,
}: {
  section: Section;
  site: Site;
  plan: PlanDef;
  chat: ChatMessage[];
  /** Hostname serving this page — required by Twitch's embed player. */
  host: string;
  /** Platform origin, for links back to us from a custom domain. */
  appUrl: string;
}) {
  const c = section.content;
  switch (section.type) {
    case "hero":
      return (
        <section className="px-6 pb-16 pt-24 text-center">
          <h1 className="site-w-lg mx-auto text-[2.25em] font-extrabold leading-tight sm:text-[3.75em]">{c.heading}</h1>
          {c.subheading && <p className="mx-auto mt-5 max-w-xl text-[1.125em] site-ink-soft">{c.subheading}</p>}
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
        <section className="site-w-lg mx-auto px-6 py-14">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start">
            {c.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.imageUrl} alt={c.heading} className="h-36 w-36 shrink-0 rounded-2xl object-cover" />
            )}
            <div className="text-center sm:text-left">
              <h2 className="text-[1.5em] font-bold">{c.heading}</h2>
              <p className="mt-3 whitespace-pre-line site-ink-soft">{c.body}</p>
            </div>
          </div>
        </section>
      );
    case "bonus": {
      const items = parseLines(c.items ?? "");
      return (
        <section id="content" className="site-w-lg mx-auto px-6 py-14">
          <h2 className="text-center text-[1.5em] font-bold">{c.heading}</h2>
          <div className="mt-8 space-y-4">
            {items.map(([title, desc, url], i) => (
              <a
                key={i}
                href={url || "#"}
                className="site-card block rounded-2xl p-5"
                style={{ background: "var(--site-card)" }}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">{title}</p>
                    {desc && <p className="mt-1 text-[0.875em] site-ink-soft">{desc}</p>}
                  </div>
                  {c.ctaLabel ? (
                    <span className="shrink-0 rounded-lg border border-white/20 px-3 py-1.5 text-[0.875em] font-semibold">
                      {c.ctaLabel}
                    </span>
                  ) : (
                    <span className="site-ink-faint">→</span>
                  )}
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
        <section className="site-w-lg mx-auto px-6 py-14">
          <h2 className="text-center text-[1.5em] font-bold">{c.heading}</h2>
          {src ? (
            <div className="site-card mt-8 overflow-hidden rounded-2xl">
              <iframe src={src} className="aspect-video w-full" allowFullScreen title={c.heading} />
            </div>
          ) : (
            <p className="mt-6 text-center site-ink-faint">Video coming soon.</p>
          )}
        </section>
      );
    }
    case "links": {
      const items = parseLines(c.items ?? "");
      return (
        <section className="site-w-sm mx-auto px-6 py-14">
          <h2 className="text-center text-[1.5em] font-bold">{c.heading}</h2>
          <div className="mt-8 space-y-3">
            {items.map(([label, url], i) => (
              <a
                key={i}
                href={url || "#"}
                className="site-card block rounded-xl px-5 py-3.5 text-center font-semibold"
                style={{ background: "var(--site-card)" }}
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
        <section className="site-w-xl mx-auto px-6 py-14">
          <h2 className="text-center text-[1.5em] font-bold">{c.heading}</h2>
          {/* site-grid: lets the container queries in globals.css narrow the
              columns when this section is running in half a page. */}
          <div className="site-grid mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(([name, price, img, buyUrl], i) => (
              <div key={i} className="site-card overflow-hidden rounded-2xl" style={{ background: "var(--site-card)" }}>
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={name} className="aspect-square w-full object-cover" />
                ) : (
                  <div className="flex aspect-[5/2] w-full items-center justify-center bg-white/5 text-[0.875em] site-ink-faint sm:aspect-square">{name}</div>
                )}
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{name}</p>
                    <p className="site-ink-soft">{price}</p>
                  </div>
                  {plan.payments && buyUrl ? (
                    <a
                      href={buyUrl}
                      className="mt-3 block rounded-lg py-2 text-center text-[0.875em] font-semibold text-white transition hover:opacity-90"
                      style={{ background: "var(--site-accent)" }}
                    >
                      {c.buyLabel || "Buy now"}
                    </a>
                  ) : (
                    <p className="site-keep-center mt-3 rounded-lg border border-white/10 py-2 text-center text-[0.875em] site-ink-faint">
                      {c.soonLabel || "Available soon"}
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
          <div className="site-card site-w-md mx-auto rounded-3xl px-6 py-12 text-center" style={{ background: "var(--site-card)" }}>
            <h2 className="text-[1.5em] font-bold">{c.heading}</h2>
            {c.body && <p className="mx-auto mt-3 max-w-md site-ink-soft">{c.body}</p>}
            <NewsletterSignup siteId={site.id} buttonLabel={c.buttonLabel ?? "Subscribe"} />
          </div>
        </section>
      );
    }
    case "calendar": {
      if (!plan.calendar) return null;
      const url = c.calendarUrl || site.config.calendlyUrl || "";
      return (
        <section className="site-w-lg mx-auto px-6 py-14 text-center">
          <h2 className="text-[1.5em] font-bold">{c.heading}</h2>
          {c.body && <p className="mx-auto mt-3 max-w-md site-ink-soft">{c.body}</p>}
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-block rounded-xl px-7 py-3 font-semibold text-white transition hover:opacity-90"
              style={{ background: "var(--site-accent)" }}
            >
              Open calendar
            </a>
          ) : (
            <p className="mt-6 site-ink-faint">Calendar link coming soon.</p>
          )}
        </section>
      );
    }
    case "chatroom": {
      if (!plan.chatroom || site.config.chatroomEnabled === false) return null;
      return (
        <section className="site-w-md mx-auto px-6 py-14">
          <h2 className="text-center text-[1.5em] font-bold">{c.heading}</h2>
          <div className="site-card mt-8 rounded-3xl p-6" style={{ background: "var(--site-card)" }}>
            <p className="text-center text-[0.875em] site-ink-soft">{c.body}</p>
            <div className="mt-5 max-h-80 space-y-3 overflow-y-auto">
              {chat.length === 0 && (
                <p className="text-center text-[0.875em] site-ink-faint">No messages yet — say hi.</p>
              )}
              {chat.map((m) => (
                <div key={m.id} className="w-fit max-w-[80%] rounded-2xl rounded-bl-sm bg-white/10 px-4 py-2 text-[0.875em]">
                  <span className="mr-2 font-semibold" style={{ color: "var(--site-accent)" }}>
                    {m.author}
                  </span>
                  {m.body}
                </div>
              ))}
            </div>
            <ChatBox siteId={site.id} sendLabel={c.sendLabel || "Send"} />
          </div>
        </section>
      );
    }
    case "live": {
      if (!plan.live) return null;
      const { twitchChannel, facebookLiveUrl, instagramLiveUser } = site.config;
      const hasAny = twitchChannel || facebookLiveUrl || instagramLiveUser;
      return (
        <section className="site-w-lg mx-auto px-6 py-14">
          <h2 className="flex items-center justify-center gap-3 text-center text-[1.5em] font-bold">
            {c.heading}
            {site.config.liveNow && (
              <span className="flex items-center gap-1.5 rounded-full bg-red-500/20 px-3 py-1 text-[0.75em] font-bold uppercase text-red-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" /> Live
              </span>
            )}
          </h2>
          {c.body && <p className="mx-auto mt-3 max-w-md text-center site-ink-soft">{c.body}</p>}
          {!hasAny && <p className="mt-6 text-center site-ink-faint">No live streams linked yet.</p>}
          <div className="mt-8 space-y-6">
            {twitchChannel && (
              <iframe
                src={`https://player.twitch.tv/?channel=${encodeURIComponent(twitchChannel)}&parent=${encodeURIComponent(host)}&muted=true`}
                className="site-card aspect-video w-full rounded-2xl"
                allowFullScreen
                title="Twitch stream"
              />
            )}
            {facebookLiveUrl && (
              <iframe
                src={`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(facebookLiveUrl)}&show_text=false`}
                className="site-card aspect-video w-full rounded-2xl"
                allowFullScreen
                title="Facebook Live"
              />
            )}
            {instagramLiveUser && (
              <p className="site-keep-center text-center">
                <a
                  href={`https://instagram.com/${encodeURIComponent(instagramLiveUser)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block rounded-xl px-7 py-3 font-semibold text-white transition hover:opacity-90"
                  style={{ background: "var(--site-accent)" }}
                >
                  {c.ctaLabel || "Watch my Instagram Live"}
                </a>
              </p>
            )}
          </div>
        </section>
      );
    }
    case "contact":
      return (
        <section className="site-w-md mx-auto px-6 py-14 text-center">
          <h2 className="text-[1.5em] font-bold">{c.heading}</h2>
          {c.body && <p className="mx-auto mt-3 max-w-md site-ink-soft">{c.body}</p>}
          {c.email && (
            <a href={`mailto:${c.email}`} className="site-card mt-6 inline-block rounded-xl px-7 py-3 font-semibold">
              {c.buttonLabel || c.email}
            </a>
          )}
        </section>
      );
    case "footer": {
      // Policies are shown one of two ways: a link when the creator has one
      // hosted, otherwise a <details> that opens the text in place. Native
      // <details> so it needs no JavaScript and stays keyboard-usable — and
      // so a visitor reading the privacy policy never leaves the page.
      const tagline = c.tagline || site.config.tagline || "";
      const policies: Array<{ label: string; url: string; text: string }> = [
        { label: "Privacy policy", url: c.privacyUrl ?? "", text: c.privacyText ?? "" },
        { label: "Terms & conditions", url: c.termsUrl ?? "", text: c.termsText ?? "" },
      ].filter((p) => p.url || p.text);
      return (
        <footer className="site-w-lg mx-auto px-6 py-12 text-center">
          <div className="border-t pt-8" style={{ borderColor: "var(--site-border-color, rgba(255,255,255,0.12))" }}>
            {tagline && <p className="text-[0.95em] site-ink-soft">{tagline}</p>}
            {policies.length > 0 && (
              <div className="mt-4 flex flex-wrap items-start justify-center gap-x-6 gap-y-3 text-[0.8em]">
                {policies.map((p) =>
                  p.url ? (
                    <a
                      key={p.label}
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="site-ink-soft underline underline-offset-4 hover:opacity-100"
                    >
                      {p.label}
                    </a>
                  ) : (
                    <details key={p.label} className="max-w-md text-left">
                      <summary className="cursor-pointer list-none text-center site-ink-soft underline underline-offset-4">
                        {p.label}
                      </summary>
                      <p className="mt-3 whitespace-pre-line text-[0.95em] leading-relaxed site-ink-faint">{p.text}</p>
                    </details>
                  )
                )}
              </div>
            )}
            {c.copyright && <p className="mt-4 text-[0.75em] site-ink-faint">{c.copyright}</p>}
            {!plan.whiteLabel && (
              <p className="mt-4 text-[0.75em] site-ink-faint">
                Powered by{" "}
                <a href={appUrl || "/"} className="font-semibold site-ink-soft">
                  Ensemble
                </a>
              </p>
            )}
          </div>
        </footer>
      );
    }
    default:
      return null;
  }
}

/**
 * Full public rendering of a creator page — shared by /[slug] and custom
 * domains (/domain/[host]). Owner links and the "Powered by" link use APP_URL
 * so they point back at the platform even when served on a customer domain.
 */
export async function PublicSite({ site, preview = false }: { site: Site; preview?: boolean }) {
  const user = await getCurrentUser();
  const isOwner = user?.id === site.userId;

  // A live page needs a live subscription — sites published in preview mode
  // (or whose subscription lapsed) stop serving once billing is enabled.
  if ((!site.published || !billingOk(site)) && !(preview && isOwner)) {
    return (
      // Fixed colors, not platform tokens: a creator page must look the same
      // to every visitor regardless of the light/dark preference they happen
      // to have set on the dashboard.
      <div className="flex flex-1 flex-col items-center justify-center bg-[#0b0714] px-6 py-24 text-center text-white">
        <h1 className="mt-4 text-[1.5em] font-bold">This page isn&apos;t live yet</h1>
        <p className="mt-2 site-ink-soft">Check back soon.</p>
      </div>
    );
  }

  const plan = getPlan(site.plan);
  // Sections beyond the plan's limit stay in the builder but come off the
  // live page ("sections above a lower plan's limit just unpublish").
  const sections = getSections(site.id).slice(0, plan.maxSections);
  const chat = plan.chatroom && site.config.chatroomEnabled !== false ? getChatMessages(site.id, 50) : [];
  const h = await headers();
  const host = (h.get("host") ?? "localhost").split(":")[0];
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");

  // Count the visit (skip the owner checking their own page).
  if (site.published && !isOwner) {
    let refHost = "";
    try {
      refHost = new URL(h.get("referer") ?? "").host;
    } catch {}
    recordPageView(site.id, refHost === (h.get("host") ?? "") ? "" : refHost);
  }

  // One composed stack — accent glow, the creator's image, the preset's own
  // layers, their base colour — so a preset is a starting point rather than a
  // mode that switches the other controls off. Rendered on a fixed,
  // viewport-sized underlay: `cover` on the page element itself would scale
  // images to the FULL page height, magnifying them into an invisible wash on
  // long pages.
  const cfg = site.config;
  const mode = getColorMode(cfg.colorMode);
  const glow = cfg.gradient !== false;
  const card = (color: string) =>
    `${cfg.cardImage ? `url("${cfg.cardImage}") center / cover no-repeat, ` : ""}${color}`;

  // Both palettes are always computed; which one the visitor sees is decided
  // by the stylesheet below, not here.
  const darkPalette = {
    backdrop: backdropCss({
      themeId: cfg.themeId,
      accent: cfg.themeColor,
      bgColor: cfg.bgColor ?? "#0a0812",
      bgImage: cfg.bgImage,
      glow,
    }),
    card: card(cfg.cardColor ?? "rgba(255,255,255,0.05)"),
    ink: cfg.textColor || DEFAULT_TEXT_COLOR,
    edges: false,
  };
  const lightPalette = {
    backdrop: backdropCss({
      // Falls back to the dark preset, so a creator who picked a backdrop and
      // then switched light mode on gets that backdrop rather than nothing.
      themeId: cfg.lightThemeId ?? cfg.themeId,
      accent: cfg.themeColor,
      bgColor: cfg.lightBgColor ?? DEFAULT_LIGHT_BG,
      bgImage: cfg.bgImage,
      glow,
    }),
    card: card(cfg.lightCardColor ?? DEFAULT_LIGHT_CARD),
    ink: cfg.lightTextColor || DEFAULT_LIGHT_TEXT_COLOR,
    edges: true,
  };

  const border = borderVars(cfg.borderStyle, cfg.themeColor);
  // Widths and shadow don't change with the mode, so they stay inline. The
  // colours do, and an inline custom property beats every selector — so they
  // have to live in the stylesheet or the light rules could never win.
  const { "--site-border-color": edge, "--site-border-left-color": edgeLeft, "--site-border-hover": edgeHover, ...borderShape } = border;

  const paletteVars = (p: typeof darkPalette) =>
    [
      [`--site-bd-color`, p.backdrop.backgroundColor],
      [`--site-bd-image`, p.backdrop.backgroundImage ?? "none"],
      [`--site-bd-size`, p.backdrop.backgroundSize ?? "auto"],
      [`--site-bd-pos`, p.backdrop.backgroundPosition ?? "0% 0%"],
      [`--site-bd-repeat`, p.backdrop.backgroundRepeat ?? "repeat"],
      [`--site-card`, p.card],
      [`--site-ink`, p.ink],
      [`--site-border-color`, p.edges ? edgeForLight(edge) : edge],
      [`--site-border-left-color`, p.edges ? edgeForLight(edgeLeft) : edgeLeft],
      [`--site-border-hover`, p.edges ? edgeForLight(edgeHover) : edgeHover],
    ]
      .map(([k, v]) => `${k}:${v}`)
      .join(";");

  // "light" is a single look, so it is simply the base rule. "auto" ships the
  // dark palette as the base and switches on either the visitor's explicit
  // choice or, with no JavaScript at all, their device preference.
  const base = mode === "light" ? lightPalette : darkPalette;
  const modeCss = [
    `.site-root{${paletteVars(base)}}`,
    ...(mode === "auto"
      ? [
          `.site-root[data-site-mode="light"]{${paletteVars(lightPalette)}}`,
          `@media (prefers-color-scheme: light){.site-root[data-site-mode="auto"]{${paletteVars(lightPalette)}}}`,
        ]
      : []),
  ].join("");

  const underlay: React.CSSProperties = {
    backgroundColor: "var(--site-bd-color)",
    backgroundImage: "var(--site-bd-image, none)",
    backgroundSize: "var(--site-bd-size, auto)",
    backgroundPosition: "var(--site-bd-pos, 0% 0%)",
    backgroundRepeat: "var(--site-bd-repeat, repeat)",
  };

  const layout = getLayout(cfg.layout);

  return (
    <div
      className={`site-root site-ink site-align-${getTextAlign(cfg.textAlign)} relative isolate flex-1`}
      data-site-mode={mode === "auto" ? "auto" : mode}
      style={
        {
          "--site-accent": cfg.themeColor,
          // Container width and border style: the .site-w-* / .site-card rules
          // in globals.css read these, so one declaration here restyles every
          // section on the page. Colours are in the stylesheet above instead,
          // because they change with the light/dark mode.
          "--site-size": cfg.containerSize ?? DEFAULT_SIZE,
          // Type: one family and a base size every text size on the page is
          // expressed as a multiple of (see the em values above), so the scale
          // moves the headline and the fine print together.
          fontFamily: getFont(cfg.fontId).family,
          fontSize: `calc(1rem * ${cfg.fontScale || DEFAULT_TEXT_SIZE})`,
          ...borderShape,
        } as React.CSSProperties
      }
    >
      <style dangerouslySetInnerHTML={{ __html: modeCss }} />
      {/* Runs before paint so a remembered choice doesn't flash the other
          palette first. Visitors who've chosen nothing keep the server-rendered
          "auto", which the media query already resolved. */}
      {mode === "auto" && (
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var m=localStorage.getItem('ensemble-site-mode');" +
              "if(m==='light'||m==='dark'){document.currentScript.parentElement.dataset.siteMode=m}}catch(e){}})()",
          }}
        />
      )}
      {mode === "auto" && <SiteModeToggle />}
      <div aria-hidden className="fixed inset-0 -z-10" style={underlay} />
      {/* Platform chrome, not the creator's page — fixed size and colour so it
          doesn't ride the creator's type scale. */}
      {isOwner && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-3 border-b border-white/10 bg-black/60 px-4 py-2 text-xs text-white backdrop-blur">
          <span className={site.published ? "text-emerald-400" : "text-amber-400"}>
            {site.published ? "● Live" : "● Draft preview — only you can see this"}
          </span>
          <a href={`${appUrl}/dashboard/builder`} className="font-semibold underline underline-offset-2">
            Edit page
          </a>
        </div>
      )}
      {/* Every section is wrapped the same way in every layout — the
          arrangement is the wrapper's class, never a different rendering of
          the section, so switching layouts can't disturb the content. */}
      <div className={layout ? `site-layout-${layout.id}` : undefined}>
        {sections.map((s, i) => {
          // A per-section theme renders the section inside a themed band.
          const containerTheme = themeCss(s.theme, cfg.themeColor);
          const full = FULL_WIDTH_TYPES.has(s.type);
          // Staggered sides alternate across the sections that take part,
          // ignoring the full-width ones — counted here rather than in CSS,
          // where a hero mid-page would flip every section beneath it.
          const side =
            layout?.id === "stagger" && !full
              ? sections.slice(0, i).filter((p) => !FULL_WIDTH_TYPES.has(p.type)).length % 2 === 0
                ? "site-left"
                : "site-right"
              : "";
          return (
            <div key={s.id} className={`${full ? "site-full" : ""} ${side}`.trim() || undefined}>
              {containerTheme ? (
                <div className="site-band site-card mx-auto my-8 overflow-hidden rounded-3xl" style={containerTheme}>
                  <SectionView section={s} site={site} plan={plan} chat={chat} host={host} appUrl={appUrl} />
                </div>
              ) : (
                <SectionView section={s} site={site} plan={plan} chat={chat} host={host} appUrl={appUrl} />
              )}
            </div>
          );
        })}
      </div>
      {/* The automatic footer stands down when the creator has added a Footer
          section — that section carries the tagline, the policies and the
          Powered by line, so keeping both would print the footer twice. */}
      {!sections.some((s) => s.type === "footer") && (site.config.tagline || !plan.whiteLabel) && (
        <footer className="border-t border-white/10 px-6 py-10 text-center text-[0.875em] site-ink-faint">
          {site.config.tagline && <p className="mb-2 site-ink-soft">{site.config.tagline}</p>}
          {!plan.whiteLabel && (
            <p>
              Powered by{" "}
              <a href={appUrl || "/"} className="font-semibold site-ink-soft hover:text-white">
                Ensemble
              </a>
            </p>
          )}
        </footer>
      )}
    </div>
  );
}
