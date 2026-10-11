/**
 * The Forja mark: a 1200×630 card resting on an anvil's waist, with two
 * sparks flying off it. Drawn on a 32-unit grid so it stays crisp at the
 * favicon size, and kept in sync with src/app/icon.svg by hand.
 */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="3" y="9" width="26" height="14" rx="3" fill="none" stroke="#ff6a2b" strokeWidth="2.5" />
      <path d="M11 23v4h10v-4" fill="none" stroke="#ff6a2b" strokeWidth="2.5" />
      <circle cx="24" cy="5" r="2" fill="#ffb27a" />
      <circle cx="28" cy="8" r="1.3" fill="#ffb27a" />
    </svg>
  );
}

export default function Logo() {
  return (
    <span className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight text-zinc-100">
      <LogoMark />
      OGsmith
    </span>
  );
}
