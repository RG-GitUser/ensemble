"use client";

import { useState } from "react";
import { MAX_SCHEDULE_DAYS, safeZone, toLocalInput } from "@/lib/schedule";

/**
 * "Send now" or "Schedule", for both composers.
 *
 * One component rather than a picker in each: the two ends have to agree about
 * the field name, the zone shown, and what an empty value means, and the way
 * that agreement breaks is somebody fixing one composer.
 *
 * Empty means now. The server treats an absent or near-immediate time as an
 * immediate send, so the toggle is a convenience and not a second code path -
 * clearing the input and submitting does exactly what "Send now" does.
 */
export function ScheduleField({ zone, verb = "Post" }: { zone: string; verb?: string }) {
  const [later, setLater] = useState(false);
  const tz = safeZone(zone);

  // datetime-local wants wall-clock in the creator's zone, not the browser's -
  // those differ whenever somebody travels or sets a zone that is not the
  // machine's, which is exactly who this setting exists for.
  const now = new Date();
  const min = toLocalInput(now.toISOString(), tz);
  const max = toLocalInput(new Date(now.getTime() + MAX_SCHEDULE_DAYS * 86_400_000).toISOString(), tz);

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["now", "later"] as const).map((mode) => {
          const on = (mode === "later") === later;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => setLater(mode === "later")}
              aria-pressed={on}
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                on ? "bg-brand text-white" : "border border-line text-mist hover:text-ink"
              }`}
            >
              {mode === "now" ? `${verb} now` : "Schedule"}
            </button>
          );
        })}
      </div>

      {/* Unmounted rather than hidden when sending now, so no stale value can
          be submitted by a form the creator switched back to "now". */}
      {later && (
        <div className="mt-2">
          <label htmlFor="scheduledFor" className="block text-xs font-semibold text-mist">
            When to send
          </label>
          <input
            id="scheduledFor"
            name="scheduledFor"
            type="datetime-local"
            min={min}
            max={max}
            required
            className="field mt-1 text-sm"
          />
          <p className="mt-1 text-xs text-mist/70">
            Times are in {tz}. Change it in{" "}
            <a href="/dashboard/settings" className="underline">Settings</a>.
          </p>
        </div>
      )}
    </div>
  );
}
