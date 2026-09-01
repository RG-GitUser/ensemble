"use client";

import { useEffect, useState, useTransition } from "react";
import { reorderSectionsAction, saveSectionStylesAction } from "@/lib/actions";
import { getTemplate } from "@/lib/sections";
import { TEXT_SIZES } from "@/lib/fonts";
import { BULLET_SHAPES, MARKER_MODES, MARKER_POSITIONS } from "@/lib/theme";

export interface RearrangeSection {
  id: number;
  type: string;
  /** The creator's own heading, or the template's name when they cleared it. */
  heading: string;
  /** Subheading or body, whichever the template has. */
  sub: string;
  /** First few row labels for the list-shaped sections (links, merch, bonus). */
  items: string[];
  /** Everything the style rail edits, so a block can be restyled in place. */
  sectionMarker: string;
  sectionBulletShape: string;
  markerMode: string;
  bulletShape: string;
  markerPosition: string;
  textScale: string;
}


/** Section types whose content is a list, so row markers have rows to mark. */
const LIST_TYPES = new Set(["bonus", "links"]);

/**
 * One setting in the rail: the options, and an "all" that applies the current
 * choice to every section.
 *
 * "Apply to all" only makes sense when you can see all of them, which is the
 * argument for putting these here rather than in a dropdown on a form. It
 * writes the value you just picked, so the sequence is always pick, then
 * spread — never spread something you have not looked at.
 */
function RailGroup({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: Array<{ id: string; label: string }>;
  value: string;
  onPick: (value: string, all: boolean) => void;
}) {
  return (
    <div className="mt-4 border-t border-edge pt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-mist">{label}</span>
        <button
          type="button"
          onClick={() => onPick(value, true)}
          className="text-[10px] font-semibold text-brand hover:underline"
        >
          Apply to all
        </button>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={value === o.id}
            onClick={() => onPick(o.id, false)}
            className={`border px-2 py-1 text-[11px] font-medium transition ${
              value === o.id ? "border-brand bg-brand/10 text-snow" : "border-edge text-mist hover:border-brand/60"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A faint block standing in for a picture, a player or a field. */
function Fill({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={className} style={{ background: "currentColor", opacity: 0.14, ...style }} />;
}

/**
 * The shape each section actually takes on the page.
 *
 * A single generic card told you nothing about what you were moving, and every
 * section looked alike. These mirror the real renderers in PublicSite: bonus
 * stacks cards, merch is a grid of tiles, links stack full-width bars, video
 * and live are 16:9 frames, chat is bubbles. Not the content pixel for pixel,
 * but the silhouette, which is what you are actually arranging.
 */
function SectionShape({ s, radius }: { s: RearrangeSection; radius: string }) {
  const r = { borderRadius: radius };
  const rows = s.items.length ? s.items : ["", "", ""];

  switch (s.type) {
    case "hero":
      return (
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <p className="text-lg font-extrabold leading-tight">{s.heading}</p>
          {s.sub && <p className="line-clamp-2 text-[11px] opacity-70">{s.sub}</p>}
          <Fill className="mt-1 h-6 w-28" style={r} />
        </div>
      );

    case "video":
    case "live":
      return (
        <div className="space-y-2">
          <p className="text-sm font-bold">{s.heading}</p>
          <Fill className="aspect-video w-full" style={r} />
        </div>
      );

    case "merch":
      return (
        <div className="space-y-2">
          <p className="text-sm font-bold">{s.heading}</p>
          <div className="grid grid-cols-3 gap-1.5">
            {rows.slice(0, 3).map((label, i) => (
              <div key={i} className="border border-current/25 p-1.5" style={r}>
                <Fill className="mb-1 h-8 w-full" style={r} />
                <p className="truncate text-[9px] opacity-70">{label || "Product"}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case "bonus":
      return (
        <div className="space-y-2">
          <p className="text-sm font-bold">{s.heading}</p>
          <div className="space-y-1.5">
            {rows.slice(0, 3).map((label, i) => (
              <div key={i} className="border border-current/25 px-2 py-1.5" style={r}>
                <p className="truncate text-[10px] opacity-75">{label || "Drop"}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case "links":
      return (
        <div className="space-y-2">
          <p className="text-sm font-bold">{s.heading}</p>
          <div className="space-y-1.5">
            {rows.slice(0, 3).map((label, i) => (
              <div key={i} className="border border-current/40 px-2 py-1.5 text-center" style={r}>
                <p className="truncate text-[10px] font-semibold">{label || "Link"}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case "newsletter":
      return (
        <div className="space-y-2 text-center">
          <p className="text-sm font-bold">{s.heading}</p>
          {s.sub && <p className="line-clamp-2 text-[11px] opacity-70">{s.sub}</p>}
          <div className="flex gap-1.5 pt-1">
            <Fill className="h-6 flex-1" style={r} />
            <Fill className="h-6 w-14" style={{ ...r, opacity: 0.3 }} />
          </div>
        </div>
      );

    case "chatroom":
      return (
        <div className="space-y-2">
          <p className="text-sm font-bold">{s.heading}</p>
          <div className="space-y-1.5">
            <Fill className="h-5 w-3/5" style={r} />
            <Fill className="ml-auto h-5 w-2/5" style={r} />
            <Fill className="h-5 w-1/2" style={r} />
          </div>
        </div>
      );

    case "calendar":
      return (
        <div className="space-y-2">
          <p className="text-sm font-bold">{s.heading}</p>
          {s.sub && <p className="line-clamp-1 text-[11px] opacity-70">{s.sub}</p>}
          <Fill className="h-16 w-full" style={r} />
        </div>
      );

    case "contact":
      return (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm font-bold">{s.heading}</p>
          {s.sub && <p className="line-clamp-2 text-[11px] opacity-70">{s.sub}</p>}
          <Fill className="h-6 w-24" style={r} />
        </div>
      );

    case "footer":
      return (
        <div className="space-y-1 text-center">
          <p className="text-xs font-semibold opacity-80">{s.heading}</p>
          {s.sub && <p className="line-clamp-1 text-[10px] opacity-55">{s.sub}</p>}
        </div>
      );

    default:
      return (
        <div className="space-y-1.5">
          <p className="text-sm font-bold">{s.heading}</p>
          {s.sub && <p className="line-clamp-3 text-[11px] opacity-70">{s.sub}</p>}
        </div>
      );
  }
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
  cardStyle,
  ink,
  pageBg,
  onClose,
}: {
  sections: RearrangeSection[];
  layout: string;
  /** The same container styling the side preview uses, so blocks match the page. */
  cardStyle: React.CSSProperties;
  /** The creator's ink, so text on those containers reads as it will live. */
  ink: string;
  /** The page's own background behind the blocks. */
  pageBg: string;
  onClose: () => void;
}) {
  const [order, setOrder] = useState<RearrangeSection[]>(sections);
  const [dragId, setDragId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  // Which block the rail is editing. Null means the rail is closed, which is
  // also the state you land in, so the canvas is the first thing you see.
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = order.find((s) => s.id === selectedId) ?? null;

  /** Change one field on the selected section, or on every section. */
  function setField(field: keyof RearrangeSection, value: string, all = false) {
    setOrder((prev) =>
      prev.map((s) => (all || s.id === selectedId ? { ...s, [field]: value } : s))
    );
  }

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
  // Inner pieces round at roughly half the container's radius, the same
  // relationship the page keeps between a card and the button inside it.
  const outer = Number.parseFloat(String(cardStyle.borderRadius ?? "0")) || 0;
  const innerRadius = `${(outer / 2).toFixed(3)}rem`;
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

  const reordered = order.some((s, i) => s.id !== sections[i]?.id);
  const restyled = order.some((s) => {
    const was = sections.find((o) => o.id === s.id);
    return (
      !was ||
      was.sectionMarker !== s.sectionMarker ||
      was.sectionBulletShape !== s.sectionBulletShape ||
      was.markerMode !== s.markerMode ||
      was.bulletShape !== s.bulletShape ||
      was.markerPosition !== s.markerPosition ||
      was.textScale !== s.textScale
    );
  });
  const dirty = reordered || restyled;

  function save() {
    startTransition(async () => {
      // Styles first: reordering revalidates the page, so writing styles after
      // it would show a page that is one save behind.
      if (restyled) {
        await saveSectionStylesAction(
          order.map((s) => ({
            id: s.id,
            sectionMarker: s.sectionMarker,
            sectionBulletShape: s.sectionBulletShape,
            markerMode: s.markerMode,
            bulletShape: s.bulletShape,
            markerPosition: s.markerPosition,
            textScale: s.textScale,
          }))
        );
      }
      if (reordered) await reorderSectionsAction(order.map((s) => s.id));
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

        <div className="flex min-h-0 flex-1">
        <div className="flex-1 overflow-y-auto p-6" style={{ background: pageBg }}>
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
                  onClick={() => setSelectedId(s.id)}
                  style={{ ...cardStyle, color: ink }}
                  className={`group relative cursor-grab p-5 transition active:cursor-grabbing ${
                    dragId === s.id
                      ? "opacity-50 ring-2 ring-brand"
                      : selectedId === s.id
                        ? "ring-2 ring-brand"
                        : "hover:ring-2 hover:ring-brand/50"
                  } ${full ? "sm:col-span-2" : ""}`}
                >
                  {/* The section drawn in the shape it actually takes on the
                      page, carrying the creator's own words, so what you drag
                      is recognisably the thing you are moving. */}
                  <SectionShape s={{ ...s, heading: s.heading || tpl?.name || s.type }} radius={innerRadius} />
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider opacity-45">
                    {tpl?.name ?? s.type} · {full ? "full width" : `position ${i + 1}`}
                  </p>
                  <div className="absolute right-2 top-2 flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                    <button
                      type="button"
                      aria-label={`Move ${tpl?.name ?? s.type} earlier`}
                      onClick={() => move(s.id, -1)}
                      disabled={i === 0}
                      className="border border-current px-2 py-1 text-xs opacity-70 transition hover:opacity-100 disabled:opacity-20"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${tpl?.name ?? s.type} later`}
                      onClick={() => move(s.id, 1)}
                      disabled={i === order.length - 1}
                      className="border border-current px-2 py-1 text-xs opacity-70 transition hover:opacity-100 disabled:opacity-20"
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

        {selected && (
          <aside className="w-72 shrink-0 overflow-y-auto border-l border-edge bg-panel p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{selected.heading || getTemplate(selected.type)?.name}</p>
                <p className="text-[11px] text-mist">{getTemplate(selected.type)?.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Close styles"
                className="shrink-0 border border-edge px-2 py-0.5 text-xs text-mist hover:text-snow"
              >
                ✕
              </button>
            </div>

            <RailGroup
              label="Section accent"
              options={MARKER_MODES.map((m) => ({ id: m.id, label: m.label }))}
              value={selected.sectionMarker}
              onPick={(v, all) => setField("sectionMarker", v, all)}
            />
            {selected.sectionMarker === "bullet" && (
              <RailGroup
                label="Accent shape"
                options={BULLET_SHAPES.map((b) => ({ id: b.id, label: b.label }))}
                value={selected.sectionBulletShape}
                onPick={(v, all) => setField("sectionBulletShape", v, all)}
              />
            )}

            {selected.sectionMarker !== "none" && selected.sectionMarker !== "bullet" && (
              <RailGroup
                label="Accent position"
                options={MARKER_POSITIONS.map((p) => ({ id: p.id, label: p.label }))}
                value={selected.markerPosition}
                onPick={(v, all) => setField("markerPosition", v, all)}
              />
            )}

            {LIST_TYPES.has(selected.type) && (
              <>
                <RailGroup
                  label="Row markers"
                  options={MARKER_MODES.map((m) => ({ id: m.id, label: m.label }))}
                  value={selected.markerMode}
                  onPick={(v, all) => setField("markerMode", v, all)}
                />
                {selected.markerMode === "bullet" && (
                  <RailGroup
                    label="Row shape"
                    options={BULLET_SHAPES.map((b) => ({ id: b.id, label: b.label }))}
                    value={selected.bulletShape}
                    onPick={(v, all) => setField("bulletShape", v, all)}
                  />
                )}
              </>
            )}

            <RailGroup
              label="Text size"
              options={TEXT_SIZES.map((t) => ({ id: t.id, label: t.label }))}
              value={selected.textScale}
              onPick={(v, all) => setField("textScale", v, all)}
            />
          </aside>
        )}
        </div>
      </div>
    </div>
  );
}
