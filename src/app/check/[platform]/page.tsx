import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import CheckerTool from "@/components/checker/CheckerTool";
import { PLATFORM_PAGES, platformPage } from "@/lib/checker/platforms";
import { jsonLdScript } from "@/lib/llms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ platform: string }>;
}): Promise<Metadata> {
  const page = platformPage((await params).platform);
  if (!page) return {};
  return {
    title: { absolute: `${page.title} · OGsmith` },
    description: page.description,
    alternates: { canonical: `/check/${page.slug}` },
    openGraph: { title: page.title, description: page.description, url: `/check/${page.slug}` },
    twitter: { card: "summary_large_image", title: page.title, description: page.description },
  };
}

export default async function PlatformCheckPage({
  params,
  searchParams,
}: {
  params: Promise<{ platform: string }>;
  searchParams: Promise<{ url?: string }>;
}) {
  const page = platformPage((await params).platform);
  if (!page) notFound();
  const { url } = await searchParams;

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faq.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-sm text-zinc-500">
          <Link href="/check" className="hover:text-zinc-300">
            Link preview checker
          </Link>{" "}
          / {page.linkLabel}
        </p>
        <h1 className="mt-2 text-balance text-[1.75rem] font-bold leading-tight sm:text-4xl">
          {page.h1}
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-zinc-400">{page.intro}</p>
        <div className="mt-8">
          <CheckerTool url={url} action={`/check/${page.slug}`} focus={page.focus} />
        </div>

        <section className="mt-16">
          <h2 className="text-xl font-bold">What {page.linkLabel.split(" ")[0]} needs from your page</h2>
          <dl className="mt-4 divide-y divide-zinc-800 rounded-xl border border-zinc-800">
            {page.rules.map((r) => (
              <div key={r.label} className="grid gap-1 p-4 sm:grid-cols-[10rem_1fr] sm:gap-4">
                <dt className="text-sm font-medium text-zinc-200">{r.label}</dt>
                <dd className="text-sm leading-relaxed text-zinc-400">{r.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-bold">Questions</h2>
          <div className="mt-4 flex flex-col gap-3">
            {page.faq.map(({ q, a }) => (
              <details key={q} className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-sm font-medium text-zinc-100">
                  {q}
                  <span aria-hidden="true" className="text-zinc-500 transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{a}</p>
              </details>
            ))}
          </div>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd) }}
          />
        </section>

        <section className="mt-12 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-semibold">Fix it once, for every page</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            OGsmith turns each page into a correctly sized card from one meta
            tag, and a new version reaches every platform when you change it.
          </p>
          <Link
            href="/signup"
            className="mt-4 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-zinc-950 hover:bg-indigo-500"
          >
            Get your free API key
          </Link>
        </section>

        <nav aria-label="Other platforms" className="mt-12 border-t border-zinc-800 pt-8">
          <h2 className="text-sm font-semibold text-zinc-300">Other platforms</h2>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {PLATFORM_PAGES.filter((p) => p.slug !== page.slug).map((p) => (
              <li key={p.slug}>
                <Link href={`/check/${p.slug}`} className="text-indigo-400 hover:underline">
                  {p.linkLabel}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/check" className="text-indigo-400 hover:underline">
                All platforms at once
              </Link>
            </li>
          </ul>
        </nav>
      </main>
      <Footer />
    </>
  );
}
