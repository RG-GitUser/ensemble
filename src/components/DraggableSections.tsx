"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { reorderSectionsAction } from "@/lib/actions";

export interface DraggableItem {
  id: number;
  node: React.ReactNode;
}

/**
 * Drag-to-reorder for the builder's section cards.
 *
 * The cards stay Server Components — this owns nothing but the order. A drag
 * begins on any element a card marks `data-drag-handle` (its header), whose
 * `draggable` attribute is plain server-rendered markup, and the dragstart
 * bubbles up to the row here. That's what keeps the cards free of client-side
 * event handlers.
 *
 * Reordering is done with CSS `order`, not by reordering the children array.
 * These nodes come from the RSC payload and React tracks them as a fixed set;
 * moving them within the array trips "The children should not have changed if
 * we pass in the same set". So the DOM order always mirrors the server and only
 * the visual order moves — which also means the flex `gap` below is load-
 * bearing, since `space-y-*` margins would follow DOM order and land in the
 * wrong gaps mid-drag.
 *
 * The up/down buttons inside each card still work and remain the keyboard and
 * touch path: HTML5 drag events don't fire for touch input, so dragging is an
 * enhancement layered on top of them, never the only way to reorder.
 */
export function DraggableSections({ items }: { items: DraggableItem[] }) {
  const serverKey = items.map((i) => i.id).join(",");
  const [order, setOrder] = useState<number[]>(() => items.map((i) => i.id));
  const [dragId, setDragId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  // Separates a real drop from a cancelled drag (Esc, or released off the
  // list), which has to put the preview back rather than save it.
  const dropped = useRef(false);

  // The server is the source of truth. Adopting every order it sends covers
  // three cases at once: our own commit landing, a change made in another tab,
  // and rolling back when the action rejects the payload.
  useEffect(() => {
    setOrder(serverKey ? serverKey.split(",").map(Number) : []);
  }, [serverKey]);

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, id: number) {
    setDragId(id);
    dropped.current = false;
    e.dataTransfer.effectAllowed = "move";
    // Firefox won't begin a drag unless some payload is set.
    e.dataTransfer.setData("text/plain", String(id));
    // The drag starts on the card's header, so without this the ghost is a
    // lone title floating around. Drag the whole card instead.
    e.dataTransfer.setDragImage(e.currentTarget, 24, 24);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>, overId: number) {
    if (dragId === null) return;
    // Allow the drop before deciding whether to reorder, and in particular
    // allow it over the dragged card itself.
    //
    // A drop only fires where dragover was prevented. Reordering moves the
    // dragged card to sit under the cursor, so the card beneath the pointer at
    // the moment of release is very often the dragged one — and returning
    // early there left the drop unprevented, no drop event, `dropped` false,
    // and dragEnd reverting the arrangement the person had just made. The
    // reorder still has nothing to do in that case; the drop does.
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragId === overId) return;

    // Swap only once the pointer passes the target's midpoint.
    //
    // Reordering on mere hover is what made this jumpy: entering a tall card
    // by one pixel swapped immediately, the layout shifted under the cursor,
    // which put it back over the original card, which swapped back — an
    // oscillation for as long as you hovered near a boundary. Requiring the
    // midpoint means a swap moves the cursor decisively into the target's
    // former half and can't instantly undo itself.
    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;

    setOrder((prev) => {
      const from = prev.indexOf(dragId);
      const to = prev.indexOf(overId);
      if (from === -1 || to === -1 || from === to) return prev;
      if (from < to && e.clientY < midpoint) return prev; // heading down, not far enough
      if (from > to && e.clientY > midpoint) return prev; // heading up, not far enough
      const next = prev.slice();
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
  }

  function handleDragEnd() {
    setDragId(null);
    if (!dropped.current) {
      setOrder(serverKey ? serverKey.split(",").map(Number) : []);
      return;
    }
    if (order.join(",") === serverKey) return;
    startTransition(() => reorderSectionsAction(order));
  }

  return (
    // The list itself accepts the drop, not only the cards. `gap-5` leaves real
    // space between them, and releasing in one of those gaps used to land on
    // no card at all — same revert as dropping on the dragged card did.
    <div
      className={`flex flex-col gap-5 transition-opacity ${pending ? "opacity-60" : ""}`}
      onDragOver={(e) => {
        if (dragId !== null) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        dropped.current = true;
      }}
    >
      {items.map((item, i) => {
        const pos = order.indexOf(item.id);
        return (
          <div
            key={item.id}
            style={{ order: pos === -1 ? i : pos }}
            onDragStart={(e) => handleDragStart(e, item.id)}
            onDragOver={(e) => handleDragOver(e, item.id)}
            onDrop={(e) => {
              e.preventDefault();
              dropped.current = true;
            }}
            onDragEnd={handleDragEnd}
            className={`transition-opacity ${dragId === item.id ? "opacity-40" : ""}`}
          >
            {item.node}
          </div>
        );
      })}
    </div>
  );
}
