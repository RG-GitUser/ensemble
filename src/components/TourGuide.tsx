"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { dismissTourAction, setTutorialsAction } from "@/lib/actions";
import { tourForPath, type TourStep } from "@/lib/tours";
import { CloseIcon } from "@/components/icons";

/**
 * First-open tutorial bubbles.
 *
 * Mounted once in the dashboard layout; it picks the tour for the current
 * route and shows it only if this person hasn't seen it. Three ways out, all
 * of them one click: dismiss this bubble (the ×, moves on to the next one),
 * finish the tour, or switch tutorials off everywhere.
 *
 * Bubbles are positioned against the real element each step names, measured
 * after paint and re-measured on resize and scroll — anchoring to a selector
 * rather than hard-coded coordinates means a bubble can't drift away from
 * what it describes when the page around it changes.
 */
export function TourGuide({ seen, enabled }: { seen: string[]; enabled: boolean }) {
  const pathname = usePathname();
  const tour = tourForPath(pathname ?? "");
  // Steps whose element isn't on this page (locked features, empty states)
  // are dropped, so a bubble never points at nothing.
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [i, setI] = useState(0);
  const [done, setDone] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const active = !!tour && enabled && !seen.includes(tour.id) && !done;

  useEffect(() => {
    // Route changed — start the new page's tour from the top.
    setI(0);
    setDone(false);
    if (!active || !tour) {
      setSteps([]);
      return;
    }
    setSteps(tour.steps.filter((s) => document.querySelector(`[data-tour="${s.target}"]`)));
    // `active` is derived from tour/seen/enabled/done; done is reset above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, enabled, tour?.id]);

  const step = active ? steps[i] : undefined;

  useLayoutEffect(() => {
    if (!step) {
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) return;
    const measure = () => setRect(el.getBoundingClientRect());
    measure();
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step]);

  if (!active || !step || !rect || !tour) return null;

  const last = i === steps.length - 1;
  function finish() {
    setDone(true);
    void dismissTourAction(tour!.id);
  }
  function next() {
    if (last) finish();
    else setI((n) => n + 1);
  }

  // Below the target when there's room, above it when there isn't. The
  // horizontal edge is clamped so a bubble beside a narrow element still
  // sits fully on screen.
  const BUBBLE = 320;
  const below = rect.bottom + 190 < window.innerHeight;
  const top = below ? rect.bottom + 12 : Math.max(12, rect.top - 12);
  const left = Math.min(Math.max(12, rect.left), window.innerWidth - BUBBLE - 12);

  return (
    <>
      {/* Ring around what the bubble is talking about. Non-interactive, so
          the page underneath stays usable while a bubble is open. */}
      <div
        aria-hidden
        className="pointer-events-none fixed z-[60] rounded-xl ring-2 ring-brand ring-offset-2 ring-offset-ink transition-all"
        style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
      />
      <div
        role="dialog"
        aria-label={step.title}
        className="fixed z-[61] w-80 rounded-2xl border border-brand/40 bg-panel p-4 shadow-2xl"
        style={{ top, left, transform: below ? undefined : "translateY(-100%)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-bold">{step.title}</h3>
          <button
            type="button"
            onClick={next}
            title="Dismiss this tip"
            aria-label="Dismiss this tip"
            className="text-mist transition hover:text-snow"
          >
            <CloseIcon />
          </button>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-mist">{step.body}</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-mist/60">
            {i + 1} of {steps.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDone(true);
                void setTutorialsAction(false);
              }}
              className="text-[11px] text-mist/80 underline underline-offset-2 hover:text-snow"
            >
              Turn tutorials off
            </button>
            <button type="button" onClick={next} className="btn-primary !py-1.5 !px-3 text-xs">
              {last ? "Got it" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
