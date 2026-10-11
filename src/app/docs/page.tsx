import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import DocsNav from "@/components/docs/DocsNav";
import { DOC_SECTIONS, Overview } from "@/components/docs/sections";
import { appUrl } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "OGsmith API reference: one GET request returns a social card PNG. Parameters, sizes, signed URLs, cards from a URL, custom templates, A/B tests, batches, webhooks and quotas.",
  alternates: { canonical: "/docs" },
};

/**
 * Sections used to live on this page as #anchors. Old links keep working by
 * moving to the section's own page; a hash never reaches the server, so this
 * has to happen in the browser.
 */
const LEGACY_ANCHORS = `(function(){var s=${JSON.stringify(
  DOC_SECTIONS.map((s) => s.slug)
)};var h=location.hash.slice(1);if(s.indexOf(h)>=0)location.replace("/docs/"+h);})();`;

export default function DocsPage() {
  // Shown in every snippet so the docs always quote this deployment's own URL.
  const base = appUrl().replace(/\/$/, "");
  return (
    <>
      <Nav />
      <script dangerouslySetInnerHTML={{ __html: LEGACY_ANCHORS }} />
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-16 sm:px-6 lg:flex-row">
        <aside className="lg:sticky lg:top-8 lg:w-52 lg:shrink-0 lg:self-start">
          <DocsNav current={null} />
        </aside>
        <main className="min-w-0 max-w-3xl flex-1">
          <h1 className="text-4xl font-bold">API reference</h1>
          <p className="mt-3 text-zinc-400">A GET request to one endpoint returns a 1200×630 PNG.</p>
          <Overview base={base} A={Link} />

          <h2 className="mt-12 text-2xl font-semibold">More in the docs</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {DOC_SECTIONS.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/docs/${s.slug}`}
                  className="block h-full rounded-xl border border-zinc-800 p-4 hover:border-zinc-600"
                >
                  <span className="font-medium text-zinc-100">{s.title}</span>
                  <span className="mt-1 block text-sm text-zinc-400">{s.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </main>
      </div>
      <Footer />
    </>
  );
}
