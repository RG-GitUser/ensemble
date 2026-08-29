"use client";

import { useState } from "react";
import { saveShopAction } from "@/lib/actions";
import { SaveButton } from "@/components/SaveButton";

/**
 * The Shop tab's product editor.
 *
 * Products live inside the merch section as pipe-separated lines — that's
 * what the Page Builder's textarea edits and what the public page renders.
 * This component gives each product a proper row of fields instead, and
 * serialises back to the same lines on save, so the two editors can never
 * disagree about what's in the shop.
 */

interface ProductRow {
  name: string;
  price: string;
  img: string;
  buy: string;
}

/** Same parsing rules as lib/sections parseLines, minus empty-line noise. */
function rowsFromItems(items: string): ProductRow[] {
  return items
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name = "", price = "", img = "", buy = ""] = l.split("|").map((p) => p.trim());
      return { name, price, img, buy };
    });
}

/** A pipe or newline typed into a field would split the line it lives in. */
function cell(v: string): string {
  return v.replace(/[|\n]/g, " ").trim();
}

function itemsFromRows(rows: ProductRow[]): string {
  return rows
    .filter((r) => r.name || r.price || r.img || r.buy)
    .map((r) => [cell(r.name), cell(r.price), cell(r.img), cell(r.buy)].join(" | "))
    .join("\n");
}

const FIELD = "field !py-2 text-sm";

export function ShopManager({
  sectionId,
  heading,
  buyLabel,
  soonLabel,
  items,
  canSell,
}: {
  sectionId: number;
  heading: string;
  buyLabel: string;
  soonLabel: string;
  items: string;
  /** Whether this plan puts real Buy buttons on the page (plan.payments). */
  canSell: boolean;
}) {
  const [rows, setRows] = useState<ProductRow[]>(() => {
    const r = rowsFromItems(items);
    return r.length ? r : [{ name: "", price: "", img: "", buy: "" }];
  });
  const [head, setHead] = useState(heading);
  const [buy, setBuy] = useState(buyLabel);
  const [soon, setSoon] = useState(soonLabel);

  function patch(i: number, key: keyof ProductRow, value: string) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  }
  function move(i: number, dir: -1 | 1) {
    setRows((rs) => {
      const j = i + dir;
      if (j < 0 || j >= rs.length) return rs;
      const next = [...rs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  return (
    <form action={saveShopAction}>
      <input type="hidden" name="sectionId" value={sectionId} />
      <input type="hidden" name="field_items" value={itemsFromRows(rows)} />
      <input type="hidden" name="field_heading" value={head} />
      <input type="hidden" name="field_buyLabel" value={buy} />
      <input type="hidden" name="field_soonLabel" value={soon} />

      <div className="space-y-3">
        {rows.map((r, i) => {
          const status = r.buy
            ? canSell
              ? { text: "Selling", cls: "bg-good/15 text-good" }
              : { text: "Link saved — needs Pro", cls: "bg-warn/15 text-warn" }
            : { text: "Showcase only", cls: "bg-panel2 text-mist" };
          return (
            <div key={i} className="rounded-xl border border-edge bg-panel2/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${status.cls}`}>
                  {status.text}
                </span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label="Move product up"
                    className="rounded-md border border-edge px-2 py-0.5 text-xs text-mist transition hover:text-snow disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === rows.length - 1}
                    aria-label="Move product down"
                    className="rounded-md border border-edge px-2 py-0.5 text-xs text-mist transition hover:text-snow disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                    aria-label="Remove product"
                    className="rounded-md border border-edge px-2 py-0.5 text-xs text-mist transition hover:border-brand2/60 hover:text-brand2"
                  >
                    ✕
                  </button>
                </span>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <input
                  className={FIELD}
                  placeholder="Product name"
                  aria-label="Product name"
                  value={r.name}
                  onChange={(e) => patch(i, "name", e.target.value)}
                />
                <input
                  className={FIELD}
                  placeholder="Price — $28"
                  aria-label="Price"
                  value={r.price}
                  onChange={(e) => patch(i, "price", e.target.value)}
                />
                <input
                  className={FIELD}
                  placeholder="Image URL (optional)"
                  aria-label="Image URL"
                  value={r.img}
                  onChange={(e) => patch(i, "img", e.target.value)}
                />
                <input
                  className={FIELD}
                  placeholder="Buy link — https://buy.stripe.com/…"
                  aria-label="Buy link"
                  value={r.buy}
                  onChange={(e) => patch(i, "buy", e.target.value)}
                />
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setRows((rs) => [...rs, { name: "", price: "", img: "", buy: "" }])}
        className="btn-ghost mt-3 !py-2 text-sm"
      >
        + Add product
      </button>

      {/* The storefront's few words of chrome, next to the products they wrap. */}
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <label className="text-xs text-mist">
          Shop heading
          <input className={`${FIELD} mt-1`} value={head} onChange={(e) => setHead(e.target.value)} placeholder="Merch" />
        </label>
        <label className="text-xs text-mist">
          Buy button label
          <input className={`${FIELD} mt-1`} value={buy} onChange={(e) => setBuy(e.target.value)} placeholder="Buy now" />
        </label>
        <label className="text-xs text-mist">
          Label when there&apos;s no buy link
          <input className={`${FIELD} mt-1`} value={soon} onChange={(e) => setSoon(e.target.value)} placeholder="Available soon" />
        </label>
      </div>

      <div className="mt-4">
        <SaveButton label="Save shop" savedLabel="Saved — it's on your page!" />
      </div>
    </form>
  );
}
