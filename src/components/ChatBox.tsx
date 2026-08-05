"use client";

import { useActionState } from "react";
import { postChatMessage, type FormState } from "@/lib/actions";

/** Public chat post form rendered inside a page's Chatroom section. */
export function ChatBox({ siteId }: { siteId: number }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(postChatMessage, {});

  return (
    <form action={formAction} className="mt-5">
      <input type="hidden" name="siteId" value={siteId} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/40 sm:w-36"
          name="author"
          placeholder="Name"
          maxLength={40}
        />
        <input
          className="w-full flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/40"
          name="body"
          placeholder="Say something…"
          maxLength={500}
          required
        />
        <button
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          style={{ background: "var(--site-accent)" }}
          disabled={pending}
        >
          {pending ? "…" : "Send"}
        </button>
      </div>
      {state.error && <p className="mt-2 text-sm text-red-300">{state.error}</p>}
    </form>
  );
}
