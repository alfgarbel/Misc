import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import CheckerTool from "@/components/checker/CheckerTool";
import { PLATFORM_PAGES } from "@/lib/checker/platforms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Link preview checker",
  description:
    "See how your link actually looks when it's shared on X, LinkedIn, Slack, Discord, WhatsApp, Facebook and iMessage — and what's wrong with your Open Graph tags.",
  alternates: { canonical: "/check" },
};

export default async function CheckPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const { url } = await searchParams;
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-balance text-[1.75rem] font-bold leading-tight sm:text-4xl">
          What does your link look like when someone shares it?
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-zinc-400">
          Paste a URL. We&apos;ll read its Open Graph tags, fetch the image,
          and show you what each platform does with them.
        </p>
        <div className="mt-8">
          <CheckerTool url={url} />
        </div>
        <nav aria-label="Checkers by platform" className="mt-16 border-t border-zinc-800 pt-8">
          <h2 className="text-sm font-semibold text-zinc-300">Checking for one platform?</h2>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {PLATFORM_PAGES.map((p) => (
              <li key={p.slug}>
                <Link href={`/check/${p.slug}`} className="text-indigo-400 hover:underline">
                  {p.linkLabel}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </main>
      <Footer />
    </>
  );
}
