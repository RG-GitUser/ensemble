"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * A sidebar row that knows whether it is the page you are on.
 *
 * The accent rail was hover-only, so nothing marked your place: every row read
 * the same while you were standing on one of them. The active row now holds
 * its rail open and lifts its label a step, and hover still previews the rail
 * on the others, so the two states stay distinguishable.
 *
 * Overview matches exactly, because /dashboard is a prefix of every other
 * route and would otherwise light up on all of them. The rest match on prefix
 * so a nested page keeps its parent row lit.
 */
export function DashboardNavLink({
  href,
  className,
  railTone = "bg-brand",
  children,
}: {
  href: string;
  className: string;
  /** Matches the row's own colour — account rows are amber, not brand. */
  railTone?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${className}${active ? " bg-panel2/70 !text-snow" : ""}`}
    >
      <span
        aria-hidden
        className={`absolute left-1 top-1/2 w-[3px] -translate-y-1/2 rounded-full ${railTone} transition-all duration-150 ${
          active ? "h-5" : "h-0 group-hover:h-5"
        }`}
      />
      {children}
    </Link>
  );
}
