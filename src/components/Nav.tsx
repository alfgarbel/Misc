import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

/**
 * On a phone there isn't room for a logo, five section links and a call to
 * action on one line, so the links move to their own row underneath while
 * the logo and the CTA — the two things someone is most likely to reach
 * for — stay on top. `order-last` plus a full-width nav does that with one
 * copy of the markup rather than a mobile and a desktop version that drift
 * apart.
 */
export default async function Nav() {
  const user = await getCurrentUser().catch(() => null);

  const cta = user ? (
    <Link
      href="/dashboard"
      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
    >
      Dashboard
    </Link>
  ) : (
    <Link
      href="/signup"
      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
    >
      Get started
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="mr-auto flex items-center gap-2 font-bold">
          <span className="inline-block h-3 w-3 rounded-full bg-indigo-500" />
          OGsmith
        </Link>

        <nav className="order-last -mx-1 flex w-full items-center gap-x-5 overflow-x-auto px-1 pt-1 text-sm text-zinc-400 sm:order-none sm:mx-0 sm:w-auto sm:gap-x-6 sm:overflow-visible sm:px-0 sm:pt-0">
          <Link href="/check" className="shrink-0 hover:text-white">
            Checker
          </Link>
          <Link href="/templates" className="shrink-0 hover:text-white">
            Templates
          </Link>
          <Link href="/docs" className="shrink-0 hover:text-white">
            Docs
          </Link>
          <Link href="/pricing" className="shrink-0 hover:text-white">
            Pricing
          </Link>
          {user ? null : (
            <Link href="/login" className="shrink-0 hover:text-white">
              Log in
            </Link>
          )}
        </nav>

        {cta}
      </div>
    </header>
  );
}
