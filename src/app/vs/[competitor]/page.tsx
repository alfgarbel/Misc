import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { CHECKED, COMPARISONS, comparison } from "@/lib/compare";
import { jsonLdScript } from "@/lib/llms";

export const dynamicParams = false;

export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ competitor: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ competitor: string }>;
}): Promise<Metadata> {
  const c = comparison((await params).competitor);
  if (!c) return {};
  return {
    title: { absolute: `${c.title} · OGsmith` },
    description: c.description,
    alternates: { canonical: `/vs/${c.slug}` },
    openGraph: { title: c.title, description: c.description, url: `/vs/${c.slug}` },
    twitter: { card: "summary_large_image", title: c.title, description: c.description },
  };
}

export default async function ComparisonPage({
  params,
}: {
  params: Promise<{ competitor: string }>;
}) {
  const c = comparison((await params).competitor);
  if (!c) notFound();

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: c.faq.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-sm text-zinc-500">Comparison</p>
        <h1 className="mt-2 text-balance text-[1.75rem] font-bold leading-tight sm:text-4xl">
          OGsmith vs {c.name}
        </h1>
        <p className="mt-4 max-w-2xl text-pretty leading-relaxed text-zinc-400">{c.summary}</p>

        {/* Phones get one card per row: a three-column table would hide our column off-screen. */}
        <dl className="mt-10 flex flex-col gap-3 sm:hidden">
          {c.rows.map((r) => (
            <div key={r.label} className="rounded-xl border border-zinc-800 p-4 text-sm">
              <dt className="font-medium text-zinc-200">{r.label}</dt>
              <dd className="mt-2 leading-relaxed text-zinc-400">
                <span className="text-zinc-500">{c.name}: </span>
                {r.them}
              </dd>
              <dd className="mt-1 leading-relaxed text-zinc-300">
                <span className="text-indigo-400">OGsmith: </span>
                {r.us}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-10 hidden overflow-x-auto rounded-xl border border-zinc-800 sm:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900/60 text-zinc-300">
              <tr>
                <th scope="col" className="w-[22%] p-4 font-medium"></th>
                <th scope="col" className="p-4 font-medium">{c.name}</th>
                <th scope="col" className="p-4 font-medium text-indigo-400">OGsmith</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {c.rows.map((r) => (
                <tr key={r.label} className="align-top">
                  <th scope="row" className="p-4 font-medium text-zinc-200">{r.label}</th>
                  <td className="p-4 leading-relaxed text-zinc-400">{r.them}</td>
                  <td className="p-4 leading-relaxed text-zinc-300">{r.us}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          {c.name} details checked in {CHECKED} from{" "}
          {c.sources.map((s, i) => (
            <span key={s.href}>
              {i > 0 ? ", " : ""}
              <a href={s.href} rel="nofollow noopener" className="underline hover:text-zinc-300">
                {s.label}
              </a>
            </span>
          ))}
          . Prices and plans change; their page is the source of truth.
        </p>

        <section className="mt-14 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 p-6">
            <h2 className="text-lg font-semibold">Choose {c.name} if</h2>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-zinc-400">
              {c.chooseThem.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-indigo-500/40 bg-indigo-500/5 p-6">
            <h2 className="text-lg font-semibold">Choose OGsmith if</h2>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-zinc-300">
              {c.chooseUs.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-bold">Questions</h2>
          <div className="mt-4 flex flex-col gap-3">
            {c.faq.map(({ q, a }) => (
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
          <h2 className="text-lg font-semibold">Try it on your own site</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Check how your links preview today, then add one meta tag to give every page a card.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-zinc-950 hover:bg-indigo-500"
            >
              Get your free API key
            </Link>
            <Link
              href="/check"
              className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:border-zinc-500"
            >
              Check a link
            </Link>
          </div>
        </section>

        <nav aria-label="Other comparisons" className="mt-12 border-t border-zinc-800 pt-8">
          <h2 className="text-sm font-semibold text-zinc-300">Other comparisons</h2>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {COMPARISONS.filter((o) => o.slug !== c.slug).map((o) => (
              <li key={o.slug}>
                <Link href={`/vs/${o.slug}`} className="text-indigo-400 hover:underline">
                  OGsmith vs {o.name}
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
