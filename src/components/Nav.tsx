import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export default async function Nav() {
  const user = await getCurrentUser().catch(() => null);
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="inline-block h-3 w-3 rounded-full bg-indigo-500" />
          OGsmith
        </Link>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-400 sm:gap-6">
          <Link href="/templates" className="hover:text-white">
            Templates
          </Link>
          <Link href="/docs" className="hover:text-white">
            Docs
          </Link>
          <Link href="/pricing" className="hover:text-white">
            Pricing
          </Link>
          {user ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="hover:text-white">
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500"
              >
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
