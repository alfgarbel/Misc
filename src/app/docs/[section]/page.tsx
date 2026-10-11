import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import DocsNav from "@/components/docs/DocsNav";
import { DOC_SECTIONS, docSection } from "@/components/docs/sections";
import { appUrl } from "@/lib/stripe";

export const dynamicParams = false;

export function generateStaticParams() {
  return DOC_SECTIONS.map((s) => ({ section: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const s = docSection((await params).section);
  if (!s) return {};
  return {
    title: `${s.title} · Docs`,
    description: s.description,
    alternates: { canonical: `/docs/${s.slug}` },
  };
}

export default async function DocsSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const s = docSection((await params).section);
  if (!s) notFound();
  const base = appUrl().replace(/\/$/, "");
  const i = DOC_SECTIONS.indexOf(s);
  const prev = DOC_SECTIONS[i - 1];
  const next = DOC_SECTIONS[i + 1];
  const { Body } = s;

  return (
    <>
      <Nav />
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-16 sm:px-6 lg:flex-row">
        <aside className="lg:sticky lg:top-8 lg:w-52 lg:shrink-0 lg:self-start">
          <DocsNav current={s.slug} />
        </aside>
        <main className="min-w-0 max-w-3xl flex-1">
          <p className="text-sm text-zinc-400">
            <Link href="/docs" className="hover:text-zinc-100">
              Docs
            </Link>
          </p>
          <h1 className="mt-2 text-4xl font-bold">{s.title}</h1>
          <Body base={base} A={Link} />

          <nav aria-label="Next and previous" className="mt-16 flex justify-between gap-4 border-t border-zinc-800 pt-6 text-sm">
            {prev ? (
              <Link href={`/docs/${prev.slug}`} className="text-indigo-400 hover:underline">
                ← {prev.title}
              </Link>
            ) : (
              <Link href="/docs" className="text-indigo-400 hover:underline">
                ← API reference
              </Link>
            )}
            {next ? (
              <Link href={`/docs/${next.slug}`} className="text-right text-indigo-400 hover:underline">
                {next.title} →
              </Link>
            ) : null}
          </nav>
        </main>
      </div>
      <Footer />
    </>
  );
}
