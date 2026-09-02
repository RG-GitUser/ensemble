/**
 * The platform's icon set. These replace the emoji and dingbats that used to
 * stand in for them — dice, sparkles, ticks, crosses, grip dots — which
 * rendered as a different picture on every OS and read as decoration rather
 * than UI. The platform ships no emoji: a grep for the pictographic ranges
 * over src/ should stay empty.
 *
 * Every icon is a currentColor stroke on a 24-unit grid, sized in `em` so it
 * matches whatever text it sits beside, and hidden from assistive tech — the
 * control around it carries the label.
 */
function Svg({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className={`inline-block shrink-0 ${className}`}
    >
      {children}
    </svg>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

export function CloseIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Svg>
  );
}

export function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </Svg>
  );
}

export function ArrowDownIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M12 5v14M19 12l-7 7-7-7" />
    </Svg>
  );
}

/** Grip dots on a drag handle. */
export function DragIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <g fill="currentColor" stroke="none">
        <circle cx="9" cy="6" r="1.6" />
        <circle cx="15" cy="6" r="1.6" />
        <circle cx="9" cy="12" r="1.6" />
        <circle cx="15" cy="12" r="1.6" />
        <circle cx="9" cy="18" r="1.6" />
        <circle cx="15" cy="18" r="1.6" />
      </g>
    </Svg>
  );
}

/** Crossing arrows — "give me a different one". */
export function ShuffleIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
    </Svg>
  );
}

/** Descending bars — the "organize into the recommended order" action. */
export function SortIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M4 6h16M4 12h10M4 18h6" />
    </Svg>
  );
}

export function CardIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect x="2" y="5" width="20" height="14" rx="2.5" />
      <path d="M2 10h20" />
    </Svg>
  );
}

export function LedgerIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v18H6.5A1.5 1.5 0 0 1 5 19.5z" />
      <path d="M9 3v18M12.5 8.5h3M12.5 12h3" />
    </Svg>
  );
}

/** Points down when a disclosure is shut, and is rotated when it is open. */
export function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden className={className}>
      <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
