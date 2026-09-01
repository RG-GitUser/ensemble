"use client";

import { useEffect, useState, useTransition } from "react";
import { reorderSectionsAction } from "@/lib/actions";
import { getTemplate } from "@/lib/sections";

export interface RearrangeSection {
  id: number;
  type: string;
}

/**
 * The pop-out rearranger: the page at a size you can actually think about.
 *
 * The side preview is small enough to judge colour and type but too small to
 * judge order, which is the thing people most often want to change. This opens
 * the same page large, as blocks you drag into the order you want, and saves
 * that order for real.
 *
 * It moves order, not position. Sections are laid out by the arrangement the
 * creator chose (see LAYOUTS) and every one of those is responsive, so there
 * is no x/y to save — dropping a block at an arbitrary pixel would mean
 * nothing the moment the page met a narrower screen. What it does show is the
 * real column count for the chosen layout, so the order you arrange is the
 * order you get.
 *
 * Dragging is an enhancement: HTML5 drag events never fire for touch, so every
 * block also carries move up and move down buttons, which are the keyboard and
 * touch path.
 */
export function RearrangeOverlay({
  sections,
  layout,
  onClose,
}: {
  sections: RearrangeSection[];
  layout: string;
  onClose: () => void;
}) {
  const [order, setOrder] = useState<RearrangeSection[]>(sections);
  const [dragId, setDragId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  // Escape closes, which is the shortcut people try first on anything modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // The page behind must not scroll while this is open, or a drag near the
  // edge scrolls the wrong thing.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  /** Two columns where the real page has two; one everywhere else. */
  const twoUp = layout === "side" || layout === "storefront";
  const spans = (type: string) => type === "hero" || type === "footer";

  function move(id: number, delta: number) {
    setOrder((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function dropOn(targetId: number) {
    if (dragId === null || dragId === targetId) return;
    setOrder((prev) => {
      const from = prev.findIndex((s) => s.id === dragId);
      const to = prev.findIndex((s) => s.id === targetId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  const dirty = order.some((s, i) => s.id !== sections[i]?.id);

  function save() {
    startTransition(async () => {
      await reorderSectionsAction(order.map((s) => s.id));
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Rearrange your page"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-full max-h-[88vh] w-full max-w-5xl flex-col border border-edge bg-panel">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-edge px-6 py-4">
          <div>
            <h2 className="text-base font-bold">Rearrange your page</h2>
            <p className="mt-0.5 text-xs text-mist">
              Drag a block where you want it, or use the arrows. Saving reorders your live page.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="btn-ghost !py-2 text-sm">
              Cancel
            </button>
            <button type="button" onClick={save} disabled={!dirty || pending} className="btn-primary !py-2 text-sm">
              {pending ? "Saving…" : "Save order"}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-ink/40 p-6">
          <div className={`mx-auto grid max-w-3xl gap-3 ${twoUp ? "sm:grid-cols-2" : "grid-cols-1"}`}>
            {order.map((s, i) => {
              const tpl = getTemplate(s.type);
              const full = twoUp && spans(s.type);
              return (
                <div
                  key={s.id}
                  draggable
                  onDragStart={() => setDragId(s.id)}
                  onDragEnd={() => setDragId(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => dropOn(s.id)}
                  className={`group flex cursor-grab items-center justify-between gap-3 border px-4 py-4 transition active:cursor-grabbing ${
                    dragId === s.id ? "border-brand bg-brand/10 opacity-60" : "border-edge bg-panel2 hover:border-brand/60"
                  } ${full ? "sm:col-span-2" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{tpl?.name ?? s.type}</p>
                    <p className="text-[11px] text-mist">
                      {full ? "Full width" : `Position ${i + 1}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Move ${tpl?.name ?? s.type} earlier`}
                      onClick={() => move(s.id, -1)}
                      disabled={i === 0}
                      className="border border-edge px-2 py-1 text-xs text-mist transition hover:border-brand/60 hover:text-snow disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${tpl?.name ?? s.type} later`}
                      onClick={() => move(s.id, 1)}
                      disabled={i === order.length - 1}
                      className="border border-edge px-2 py-1 text-xs text-mist transition hover:border-brand/60 hover:text-snow disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {order.length === 0 && (
            <p className="py-16 text-center text-sm text-mist">
              Nothing to arrange yet. Add a section in the Sections tab first.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
