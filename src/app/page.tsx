import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { PLAN_ORDER, PLANS, TIER_FEATURES, planIncludes, sectionsLabel } from "@/lib/plans";

const FEATURES = [
  { title: "Copy & paste setup", body: "Pick a section, paste your content, hit save. Your page updates instantly — no code, no drag-and-drop maze." },
  { title: "Bonus content hub", body: "Give your followers exclusive drops, behind-the-scenes and early access, all from one link." },
  { title: "Merch storefront", body: "Showcase merchandise on every plan. On Pro, paste Stripe payment links and sell directly." },
  { title: "Your own domain", body: "Connect a domain you own on Pro — your page, your URL, no Ensemble branding anywhere." },
  { title: "Post everywhere at once", body: "Write once and cross-post to every connected social account, straight from your dashboard on Pro." },
  { title: "Newsletters & memberships", body: "Collect emails and build your inner circle with Enterprise memberships." },
  { title: "Custom chatrooms", body: "Give your community a clubhouse of their own on Enterprise." },
  { title: "Live streams & simulcast", body: "Link Twitch, Facebook and Instagram Live, and go live everywhere with one click on Enterprise." },
  { title: "Calendar integrations", body: "Embed Calendly or Cal.com for meet & greets, collabs and bookings." },
];

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <div className="flex-1">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-edge/60 bg-ink/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight">
            En<span className="bg-gradient-to-r from-brand to-brand2 bg-clip-text text-transparent">semble</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <a href="#how" className="hidden px-2 text-sm text-mist hover:text-snow sm:block">How it works</a>
            <a href="#pricing" className="hidden px-2 text-sm text-mist hover:text-snow sm:block">Pricing</a>
            {user ? (
              <Link href="/dashboard" className="btn-primary !py-2 text-sm">Open dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="px-2 text-sm text-mist hover:text-snow">Log in</Link>
                <Link href="/signup" className="btn-primary !py-2 text-sm">Get started</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="glow">
        <div className="mx-auto max-w-6xl px-6 pb-20 pt-24 text-center">
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            Your audience. Your page.{" "}
            <span className="bg-gradient-to-r from-brand to-brand2 bg-clip-text text-transparent">Your business.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-xl font-semibold text-snow sm:text-2xl">
            Keep your site. Keep 100% of your sales. One dashboard.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-mist">
            Ensemble gives creators a landing page for bonus content, merch and community — copy &amp; paste
            setup, and we never take a cut of what you sell. Already have a website? We&apos;ll wire it into the
            dashboard for you.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <Link href="/signup" className="btn-primary text-base">Start from scratch — $25/mo</Link>
            <a href="#how" className="btn-ghost text-base">Integrate my website</a>
          </div>
          <p className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            <Link
              href="/demo/dashboard"
              className="font-medium text-mist underline underline-offset-4 transition hover:text-snow"
            >
              tour a live demo dashboard ↗
            </Link>
            <Link
              href="/s/demo"
              className="font-medium text-mist underline underline-offset-4 transition hover:text-snow"
            >
              see a live example page ↗
            </Link>
          </p>
        </div>
      </section>

      {/* Two paths */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Two ways to get started</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-mist">
          Whether you&apos;re starting fresh or already have a site, your dashboard is the same.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="card relative overflow-hidden">
            <span className="absolute right-4 top-4 rounded-full bg-brand/15 px-3 py-1 text-xs font-semibold text-brand">Option 1</span>
            <h3 className="mt-4 text-xl font-bold">Start From Scratch</h3>
            <p className="mt-2 text-mist">
              We host a brand-new landing page for you — bonus content for your followers, your story, merchandise sales,
              links and more. Sign up, pick a package, paste in your content, publish. Live in minutes.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Link href="/signup" className="btn-primary">Build my page</Link>
              <Link href="/s/demo" className="text-sm font-semibold text-brand hover:underline">
                See an example ↗
              </Link>
              <Link href="/demo/dashboard" className="text-sm font-semibold text-brand hover:underline">
                Tour the dashboard ↗
              </Link>
            </div>
          </div>
          <div className="card relative overflow-hidden">
            <span className="absolute right-4 top-4 rounded-full bg-brand2/15 px-3 py-1 text-xs font-semibold text-brand2">Option 2</span>
            <h3 className="mt-4 text-xl font-bold">Integrate a Current Website</h3>
            <p className="mt-2 text-mist">
              Already have a platform? Connect it yourself with our one-line snippet — or have us do it for you: invite
              us to your WordPress/Squarespace, or send your project files, and we handle the rest.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Link href="/signup?path=integrate" className="btn-ghost">Request a quote</Link>
              <Link href="/embed-demo" className="text-sm font-semibold text-brand2 hover:underline">
                See the embed in action ↗
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Statement */}
      <section className="border-t border-edge/60">
        <div className="mx-auto max-w-6xl px-6 py-24 text-center">
          <p className="text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            Built for{" "}
            <span className="bg-gradient-to-r from-brand to-brand2 bg-clip-text text-transparent">
              content creators.
            </span>
          </p>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-mist">
            Not another website builder. Every section, plan and integration exists for one job — turning your audience
            into your business.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-edge/60 bg-panel/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Everything a creator page needs</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card">
                <h3 className="font-bold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-mist">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Simple monthly pricing</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-mist">
          Every plan includes your hosted landing page and the Ensemble dashboard. Flat monthly pricing —{" "}
          <span className="font-semibold text-snow">we never take a percentage of your sales.</span>
        </p>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {PLAN_ORDER.map((id) => {
            const p = PLANS[id];
            return (
              <div
                key={id}
                className={`card relative flex flex-col ${p.highlight ? "border-brand shadow-xl shadow-brand/10" : ""}`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-brand to-brand2 px-3 py-1 text-xs font-bold text-white">
                    Most popular
                  </span>
                )}
                <h3 className="text-lg font-bold">{p.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold">${p.price}</span>
                  <span className="text-mist">/month</span>
                </div>
                <p className="mt-2 text-sm text-mist">{p.blurb}</p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                  <li className="flex items-start gap-2.5">
                    <span className="w-3.5 shrink-0 text-good">✓</span>
                    <span>{sectionsLabel(p)}</span>
                  </li>
                  {TIER_FEATURES.filter((f) => planIncludes(id, f)).map((f) => (
                    <li key={f.label} className="flex items-start gap-2.5">
                      <span className="w-3.5 shrink-0 text-good">✓</span>
                      <span>{f.label}</span>
                    </li>
                  ))}
                </ul>
                <Link href={`/signup?plan=${id}`} className={`${p.highlight ? "btn-primary" : "btn-ghost"} mt-8 w-full`}>
                  Choose {p.name}
                </Link>
              </div>
            );
          })}
        </div>

      </section>

      {/* CTA */}
      <section className="glow border-t border-edge/60">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready when you are</h2>
          <p className="mx-auto mt-3 max-w-xl text-mist">
            Your followers are one link away from everything you make.
          </p>
          <Link href="/signup" className="btn-primary mt-8 text-base">Create your page</Link>
        </div>
      </section>

      <footer className="border-t border-edge/60 py-10 text-center text-sm text-mist">
        <p>© {new Date().getFullYear()} Ensemble. Built for creators.</p>
      </footer>
    </div>
  );
}
