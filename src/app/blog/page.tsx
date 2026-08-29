import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { allPosts, formatPostDate } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Writing",
  description:
    "Notes on Open Graph images, link previews and the caches behind them — from the people who render them for a living.",
};

export default function BlogIndex() {
  const posts = allPosts();
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-balance text-3xl font-bold sm:text-4xl">Writing</h1>
        <p className="mt-3 max-w-2xl text-pretty text-zinc-400">
          Notes on link previews and the caches behind them, from building a
          renderer for them.
        </p>

        <ul className="mt-10 flex flex-col gap-4">
          {posts.map(({ meta }) => (
            <li key={meta.slug}>
              <Link
                href={`/blog/${meta.slug}`}
                className="block rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition-colors hover:border-zinc-600"
              >
                <h2 className="text-balance text-lg font-semibold text-white">
                  {meta.title}
                </h2>
                <p className="mt-2 text-pretty text-sm leading-relaxed text-zinc-400">
                  {meta.description}
                </p>
                <p className="mt-3 text-xs uppercase tracking-wider text-zinc-600">
                  <time dateTime={meta.date}>{formatPostDate(meta.date)}</time> ·{" "}
                  {meta.readingMinutes} min read
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </>
  );
}
