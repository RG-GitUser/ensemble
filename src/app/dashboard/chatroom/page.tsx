import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getChatMessages, getSiteByUser } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { deleteChatMessageAction, toggleChatroom } from "@/lib/actions";
import { UpgradeGate } from "@/components/UpgradeGate";

export default async function ChatroomPage() {
  const user = await requireUser();
  const site = getSiteByUser(user.id);
  if (!site) redirect("/dashboard");
  const plan = getPlan(site.plan);

  if (!plan.chatroom) {
    return (
      <UpgradeGate
        title="Chatroom"
        requiredPlan="Enterprise"
        body="Give your followers a clubhouse of their own — a chat space on your page that you moderate from here."
      />
    );
  }

  const enabled = site.config.chatroomEnabled !== false;
  const messages = getChatMessages(site.id, 100);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chatroom</h1>
          <p className="mt-1 text-sm text-mist">Everything posted in the chat on your page — remove anything off-key.</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              enabled ? "bg-good/15 text-good" : "bg-warn/15 text-warn"
            }`}
          >
            {enabled ? "● On" : "● Off"}
          </span>
          <form action={toggleChatroom}>
            <button className="btn-ghost !py-2 text-sm">{enabled ? "Turn off" : "Turn on"}</button>
          </form>
        </div>
      </div>

      <div className="card mt-6">
        {messages.length === 0 ? (
          <p className="text-sm text-mist">
            Nothing here yet — add a Chatroom section in the Page Builder, publish, and your followers can start
            talking.
          </p>
        ) : (
          <ul className="divide-y divide-edge">
            {[...messages].reverse().map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-semibold">{m.author}</span>{" "}
                    <span className="text-xs text-mist">{m.createdAt.slice(0, 16).replace("T", " ")}</span>
                  </p>
                  <p className="mt-0.5 break-words text-sm text-mist">{m.body}</p>
                </div>
                <form action={deleteChatMessageAction}>
                  <input type="hidden" name="messageId" value={m.id} />
                  <button className="text-mist transition hover:text-brand2" title="Delete message">
                    ✕
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 text-xs text-mist">
        The chat lives in your page&apos;s Chatroom section —{" "}
        <Link href={`/s/${site.slug}?preview=1`} target="_blank" className="text-brand hover:underline">
          view it live ↗
        </Link>
      </p>
    </div>
  );
}
