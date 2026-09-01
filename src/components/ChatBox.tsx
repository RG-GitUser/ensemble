"use client";

import { useActionState } from "react";
import { postChatMessage, type FormState } from "@/lib/actions";

/** Public chat post form rendered inside a page's Chatroom section. */
export function ChatBox({ siteId, sendLabel = "Send" }: { siteId: number; sendLabel?: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(postChatMessage, {});

  return (
    <form action={formAction} className="mt-5">
      <input type="hidden" name="siteId" value={siteId} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="site-field w-full site-round-xl px-3 py-2.5 text-sm sm:w-36"
          name="author"
          placeholder="Name"
          maxLength={40}
        />
        <input
          className="site-field w-full flex-1 site-round-xl px-3 py-2.5 text-sm"
          name="body"
          placeholder="Say something…"
          maxLength={500}
          required
        />
        <button
          className="site-btn site-round-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          style={{ background: "var(--site-accent)" }}
          disabled={pending}
        >
          {pending ? "…" : sendLabel}
        </button>
      </div>
      {state.error && <p className="mt-2 text-sm text-red-300">{state.error}</p>}
    </form>
  );
}
