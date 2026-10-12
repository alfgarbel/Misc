import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { TEMPLATES } from "@/lib/og/params";
import { SHOWCASE, showcaseSrc } from "@/lib/showcase";
import ShowcaseImage from "@/components/ShowcaseImage";

export const metadata: Metadata = {
  title: "Templates",
  description:
    "Every OGsmith card template, rendered live by the API: gradient, minimal, split, terminal, quote, announce, link and cover.",
  alternates: { canonical: "/templates" },
};

const SAMPLES: Record<
  (typeof TEMPLATES)[number],
  { title: string; subtitle?: string; site?: string; accent: string; theme: string; blurb: string }
> = {
  gradient: {
    title: "A soft glow for big launches",
    subtitle: "The default template, good for almost anything",
    site: "example.com",
    accent: "#6366f1",
    theme: "dark",
    blurb: "Radial accent glow with bottom-anchored copy. This is the default.",
  },
  minimal: {
    title: "Let the headline do the talking",
    subtitle: "Clean editorial layout with an accent bar",
    site: "blog.example.com",
    accent: "#10b981",
    theme: "light",
    blurb: "A quiet editorial layout for blogs and docs.",
  },
  split: {
    title: "Content left, color right",
    subtitle: "A bold panel that pops in the feed",
    site: "example.com",
    accent: "#f43f5e",
    theme: "light",
    blurb: "Two-column card with a decorated accent panel.",
  },
  terminal: {
    title: "npm install something-great",
    subtitle: "Made for developer tools and CLI releases",
    site: "cli.example.com",
    accent: "#34d399",
    theme: "dark",
    blurb: "Editor-window chrome, made for dev tools.",
  },
  quote: {
    title: "The best way to predict the future is to invent it",
    subtitle: "Alan Kay",
    site: "quotes.example.com",
    accent: "#a855f7",
    theme: "dark",
    blurb: "Pull-quote layout with attribution.",
  },
  announce: {
    title: "v2.0 is here",
    subtitle: "Faster, smaller, and open source",
    site: "RELEASE",
    accent: "#f59e0b",
    theme: "dark",
    blurb: "Centered announcement card with a badge pill.",
  },
  link: {
    title: "Point it at a URL, get a card",
    subtitle: "Reads the page's own title, description and image",
    site: "example.com",
    accent: "#a855f7",
    theme: "dark",
    blurb: "Made for ?url=. It pairs the page's own image with its title.",
  },
  cover: {
    title: "Three days walking the Picos de Europa",
    subtitle: "What we packed, where we slept, and the one trail we'd skip.",
    site: "trails.example.com",
    accent: "#ff6a2b",
    theme: "dark",
    blurb: "Made for ?url=. The page's own image fills the card, headline on top.",
  },
};

/**
 * Templates that draw the page's own image can't show it through the demo
 * endpoint (?url= needs a key), so their sample is a prerendered card that
 * brings its own image.
 */
const PRERENDERED: Partial<Record<(typeof TEMPLATES)[number], string>> = {
  cover: showcaseSrc("trail"),
};

function sampleUrl(template: string): string {
  const prerendered = PRERENDERED[template as keyof typeof PRERENDERED];
  if (prerendered) return prerendered;
  const s = SAMPLES[template as keyof typeof SAMPLES];
  const p = new URLSearchParams({
    template,
    title: s.title,
    accent: s.accent,
    theme: s.theme,
  });
  if (s.subtitle) p.set("subtitle", s.subtitle);
  if (s.site) p.set("site", s.site);
  return `/api/og?${p.toString()}`;
}

export default function TemplatesPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h1 className="text-4xl font-bold">Templates</h1>
        <p className="mt-3 max-w-2xl text-zinc-400">
          The API renders every card below live, from the same endpoint your
          site will call. Pass{" "}
          <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-emerald-400">
            template=&lt;name&gt;
          </code>{" "}
          to pick one.
        </p>
        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          {TEMPLATES.map((t) => (
            <div key={t}>
              <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sampleUrl(t)}
                  alt={`${t} template example`}
                  width={1200}
                  height={630}
                  loading="lazy"
                  className="aspect-[1200/630] w-full object-cover"
                />
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <h2 className="font-mono font-semibold text-indigo-300">{t}</h2>
                <p className="text-sm text-zinc-500">{SAMPLES[t].blurb}</p>
              </div>
            </div>
          ))}
        </div>
        <section className="mt-20">
          <h2 className="text-3xl font-bold tracking-tight">By kind of site</h2>
          <p className="mt-2 max-w-2xl text-zinc-400">
            The same templates with a different theme and accent. Each one is a
            single URL your pages fill in with their own title.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {SHOWCASE.map((card) => {
              const query = new URLSearchParams(card.params).toString();
              return (
                <figure key={card.slug} className="flex min-w-0 flex-col gap-3">
                  <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                    <ShowcaseImage
                      slug={card.slug}
                      alt={`Example card for ${card.useCase.toLowerCase()}`}
                      sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                      className="h-auto w-full"
                    />
                  </div>
                  <figcaption>
                    <h3 className="font-semibold text-zinc-100">{card.useCase}</h3>
                    <p className="text-sm text-zinc-400">{card.blurb}</p>
                    <code className="mt-2 block overflow-x-auto whitespace-nowrap rounded bg-zinc-900 px-2 py-1 text-xs text-emerald-400">
                      /api/og?{query}
                    </code>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </section>

        <div className="mt-14 text-center">
          <Link
            href="/signup"
            className="rounded-lg bg-indigo-600 px-6 py-3 font-medium text-zinc-950 hover:bg-indigo-500"
          >
            Get your free API key
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
