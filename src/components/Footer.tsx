import Link from "next/link";
import Logo from "@/components/Logo";
import { contactEmail } from "@/lib/stripe";
import { PLATFORM_PAGES } from "@/lib/checker/platforms";
import { COMPARISONS } from "@/lib/compare";

const COLUMNS: Array<{ title: string; links: Array<{ href: string; label: string }> }> = [
  {
    title: "Product",
    links: [
      { href: "/check", label: "Link checker" },
      { href: "/templates", label: "Templates" },
      { href: "/pricing", label: "Pricing" },
      { href: "/for/marketing", label: "For marketing teams" },
      { href: "/for/developers", label: "For developers" },
    ],
  },
  {
    // Also the internal links that help these pages get found.
    title: "Free checkers",
    links: PLATFORM_PAGES.map((p) => ({ href: `/check/${p.slug}`, label: p.linkLabel })),
  },
  {
    title: "Learn",
    links: [
      { href: "/docs", label: "Docs" },
      { href: "/blog", label: "Writing" },
      ...COMPARISONS.map((c) => ({ href: `/vs/${c.slug}`, label: `vs ${c.name}` })),
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
];

export default function Footer() {
  const email = contactEmail();
  return (
    <footer className="border-t border-zinc-800 py-12 text-sm text-zinc-400">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 sm:grid-cols-2 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="flex flex-col gap-3">
          <Link href="/" aria-label="OGsmith home" className="w-fit">
            <Logo />
          </Link>
          <p className="max-w-xs">Open Graph images as an API. Every link, forged into a card.</p>
          {email ? (
            <a href={`mailto:${email}`} className="w-fit text-zinc-300 hover:text-indigo-400">
              {email}
            </a>
          ) : null}
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title} className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{col.title}</p>
            {col.links.map((l) => (
              <Link key={l.href} href={l.href} className="w-fit hover:text-zinc-100">
                {l.label}
              </Link>
            ))}
          </nav>
        ))}
      </div>
      <p className="mx-auto mt-10 max-w-6xl px-4 text-xs text-zinc-500 sm:px-6">
        © {new Date().getFullYear()} OGsmith
      </p>
    </footer>
  );
}
