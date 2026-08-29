import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { allPosts, formatPostDate, postBySlug } from "@/lib/blog";

export function generateStaticParams() {
  return allPosts().map(({ meta }) => ({ slug: meta.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = postBySlug(slug);
  if (!post) return {};
  return {
    title: post.meta.title,
    description: post.meta.description,
    openGraph: {
      type: "article",
      title: post.meta.title,
      description: post.meta.description,
      publishedTime: post.meta.date,
      url: `/blog/${post.meta.slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: post.meta.title,
      description: post.meta.description,
    },
    alternates: { canonical: `/blog/${post.meta.slug}` },
  };
}

export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = postBySlug(slug);
  if (!post) notFound();
  const { meta, Body } = post;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <Link href="/blog" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Writing
        </Link>

        <article className="mt-6">
          <h1 className="text-balance text-3xl font-bold leading-tight sm:text-4xl">
            {meta.title}
          </h1>
          <p className="mt-4 text-xs uppercase tracking-wider text-zinc-600">
            <time dateTime={meta.date}>{formatPostDate(meta.date)}</time> ·{" "}
            {meta.readingMinutes} min read
          </p>
          <div className="mt-8">
            <Body />
          </div>
        </article>

        <aside className="mt-16 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-semibold text-white">
            Check a link before you post it
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Paste any URL and see what X, LinkedIn, Slack, Discord, WhatsApp,
            Facebook and iMessage will show for it. No account.
          </p>
          <Link
            href="/check"
            className="mt-4 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Open the checker
          </Link>
        </aside>
      </main>
      <Footer />
    </>
  );
}
