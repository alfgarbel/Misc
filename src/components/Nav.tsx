import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export default async function Nav() {
  const user = await getCurrentUser().catch(() => null);
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="inline-block h-3 w-3 rounded-full bg-indigo-500" />
          OGsmith
        </Link>
        <nav className="flex items-center gap-6 text-sm text-zinc-400">
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
