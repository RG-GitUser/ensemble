import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { countSections, getSections, getSiteByUser } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { parseLines } from "@/lib/sections";
import { fetchStripeFinance, formatMoney, type FinanceSummary } from "@/lib/finance";
import { addSectionAction } from "@/lib/actions";
import { ShopManager } from "@/components/ShopManager";
import { UpgradeGate } from "@/components/UpgradeGate";

/**
 * The Shop tab: one place to run the store.
 *
 * There is deliberately no shop database behind this page. Products already
 * live in the merch section (that's what the public page sells from), and the
 * money already flows through the creator's own Stripe account (that's what
 * Analytics reads). This page is the two of those side by side — a proper
 * editor over the merch section, and the sales numbers next to it — so
 * "manage my shop" is one tab instead of a hunt across three.
 */
export default async function ShopPage() {
  const user = await requireUser();
  const site = getSiteByUser(user.id);
  if (!site) redirect("/dashboard");
  const plan = getPlan(site.plan);

  // The merch section itself is Pro and up (sections.ts), and addSectionAction
  // refuses it below that, so without this the page would offer a button that
  // silently does nothing.
  if (!plan.payments) {
    return (
      <UpgradeGate
        title="Shop"
        requiredPlan="Pro"
        body="Sell merch straight from your page with Stripe payment links, and keep every cent. Pro also adds your own domain and one-click cross-posting to every social account."
      />
    );
  }

  const merch = getSections(site.id).find((s) => s.type === "merch") ?? null;
  const products = merch ? parseLines(merch.content.items ?? "") : [];
  const selling = products.filter((p) => !!p[3]).length;
  const atSectionLimit = !merch && countSections(site.id) >= plan.maxSections;

  // Same source Analytics reads — shown here only when it can mean sales.
  const key = plan.payments ? (site.config.financeStripeKey ?? "") : "";
  let finance: FinanceSummary | null = null;
  let financeError = "";
  if (key) {
    try {
      finance = await fetchStripeFinance(key);
    } catch {
      financeError = "Stripe rejected the saved key — reconnect it in Analytics.";
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shop</h1>
          <p className="mt-1 text-sm text-mist">
            The products on your page, and the money they bring in. You keep every cent — Ensemble never takes a cut.
          </p>
        </div>
        {merch && (
          <Link
            href={`/${site.slug}?preview=1`}
            target="_blank"
            className="rounded-lg border border-edge px-3 py-1.5 text-xs text-mist transition hover:text-snow"
          >
            See it on your page ↗
          </Link>
        )}
      </div>

      {finance && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3" data-tour="shop-snapshot">
          <Tile label="Available balance" value={formatMoney(finance.available, finance.currency)} />
          <Tile
            label="Revenue — 30 days"
            value={formatMoney(finance.gross30, finance.currency)}
            sub={`${finance.count30} payments`}
          />
          <Tile label="Pending" value={formatMoney(finance.pending, finance.currency)} />
        </div>
      )}
      {financeError && (
        <p className="mt-6 rounded-xl border border-brand2/40 bg-brand2/10 px-4 py-2.5 text-sm text-brand2">
          {financeError}
        </p>
      )}

      {!plan.payments && (
        <div className="card mt-6 border-dashed" data-tour="shop-selling">
          <span className="rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase text-warn">Pro feature</span>
          <p className="mt-3 text-sm text-mist">
            On Basic your shop is a showcase — products appear on your page with{" "}
            <span className="text-snow">&ldquo;Available soon&rdquo;</span> in place of a Buy button. Upgrade to Pro to
            paste Stripe payment links and sell directly, with every sale landing in your own Stripe account.
          </p>
          <Link href="/dashboard/settings" className="btn-primary mt-4 !py-2 text-sm">
            Upgrade in Settings
          </Link>
        </div>
      )}

      {merch ? (
        <div className="card mt-6" data-tour="shop-products">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-bold">Products</h2>
            <span className="text-xs text-mist">
              {products.length} on your page{plan.payments ? ` · ${selling} with a buy link` : ""}
            </span>
          </div>
          {plan.payments && (
            <p className="mt-1 text-sm text-mist">
              Give a product a{" "}
              <a
                href="https://dashboard.stripe.com/payment-links"
                target="_blank"
                rel="noreferrer"
                className="text-brand underline underline-offset-2"
              >
                Stripe payment link
              </a>{" "}
              and its Buy button goes live — checkout runs on Stripe, paid straight to you.
            </p>
          )}
          <div className="mt-4">
            <ShopManager
              sectionId={merch.id}
              heading={merch.content.heading ?? ""}
              buyLabel={merch.content.buyLabel ?? ""}
              soonLabel={merch.content.soonLabel ?? ""}
              items={merch.content.items ?? ""}
              canSell={plan.payments}
            />
          </div>
        </div>
      ) : (
        <div className="card mt-6 text-center" data-tour="shop-products">
          <h2 className="text-xl font-bold">Your page has no shop yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-mist">
            Products live in a Merch section on your page. Add one and it shows up here ready to fill in.
          </p>
          {atSectionLimit ? (
            <p className="mx-auto mt-4 max-w-md text-sm text-warn">
              Your page is at the {plan.maxSections}-section limit for the {plan.name} plan — remove a section in the{" "}
              <Link href="/dashboard/builder" className="underline underline-offset-2">
                Page Builder
              </Link>{" "}
              or upgrade to make room.
            </p>
          ) : (
            <form action={addSectionAction} className="mt-5">
              <input type="hidden" name="type" value="merch" />
              <button className="btn-primary !py-2 text-sm">Add the Merch section</button>
            </form>
          )}
        </div>
      )}

      {merch && (
        <p className="mt-4 text-xs text-mist/70">
          The same products are editable as text in the{" "}
          <Link href="/dashboard/builder" className="underline underline-offset-2 hover:text-snow">
            Page Builder
          </Link>
          &rsquo;s Merch Store section — this tab and that section are one and the same shop.
        </p>
      )}
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wide text-mist">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs text-mist">{sub}</p>}
    </div>
  );
}
