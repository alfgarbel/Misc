import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-zinc-800 py-10 text-sm text-zinc-500">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
        <p>© {new Date().getFullYear()} OGsmith</p>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          <Link href="/templates" className="hover:text-zinc-300">
            Templates
          </Link>
          <Link href="/docs" className="hover:text-zinc-300">
            Docs
          </Link>
          <Link href="/pricing" className="hover:text-zinc-300">
            Pricing
          </Link>
          <Link href="/terms" className="hover:text-zinc-300">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-zinc-300">
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}
