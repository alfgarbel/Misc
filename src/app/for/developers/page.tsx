import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { PLANS } from "@/lib/plans";
import { TRIAL_DAYS } from "@/lib/trial";
import { jsonLdScript } from "@/lib/llms";
import { appUrl } from "@/lib/stripe";

const TITLE = "Social cards from one GET request, on any stack";
const DESCRIPTION =
  "Point your og:image tag at OGsmith and get a 1200×630 PNG back. No headless browser, no layout code to maintain, and it works anywhere you can set a meta tag.";

export const metadata: Metadata = {
  title: { absolute: `${TITLE} · OGsmith` },
  description: DESCRIPTION,
  alternates: { canonical: "/for/developers" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/for/developers" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

/** The parts of an OG image pipeline you'd otherwise own, with where each is documented. */
const BUILT_IN: Array<{ title: string; body: string; href: string }> = [
  {
    title: "Rendering without a browser",
    body: "Cards render with satori in milliseconds and are served from a CDN. Fetches answered from the cache don't count against your quota.",
    href: "/docs",
  },
  {
    title: "Cards from a page's own metadata",
    body: "Pass url= and OGsmith reads the page's title, description and image, so the tag is identical across your templates.",
    href: "/docs/url-to-card",
  },
  {
    title: "Cache refresh",
    body: "A version number in the image address changes when a design does, so platforms that never refetch still get the new card on the next share.",
    href: "/docs/cache-refresh",
  },
  {
    title: "Signed URLs",
    body: "HMAC-signed image URLs bind the exact parameters, so a leaked link can't be reused or edited. The signing secret is rotatable.",
    href: "/docs/signed-urls",
  },
  {
    title: "Keys and usage",
    body: "Up to 10 named keys per account, each revocable, with a usage endpoint that returns your plan, renders used and renders left.",
    href: "/docs/usage",
  },
  {
    title: "Batches and webhooks",
    body: "Send a CSV, get a zip of every card, and receive a signed webhook when the batch finishes.",
    href: "/docs/batches",
  },
  {
    title: "Experiments",
    body: "Split pages between designs and report outcomes from your own analytics. The dashboard runs the significance test.",
    href: "/docs/experiments",
  },
];

/** Honest about where doing it yourself is the right call. */
const COMPARISON: Array<{ row: string; diy: string; ogsmith: string }> = [
  { row: "Cost", diy: "Free library, your hosting", ogsmith: `Free to start, from $${PLANS.pro.priceMonthlyUsd}/mo` },
  { row: "Time to first card", diy: "An afternoon of layout and font wrangling", ogsmith: "Five minutes" },
  { row: "Works outside your framework", diy: "Next.js and Vercel first", ogsmith: "Any site that can set a meta tag" },
  { row: "Cards from a page's own metadata", diy: "You write the scraper", ogsmith: "Built in, with url=" },
  { row: "New card on the next share after a redesign", diy: "You build cache-busting", ogsmith: "Built in, with a version number" },
  { row: "Design without code", diy: "No", ogsmith: "Visual editor" },
  { row: "A/B test designs", diy: "No", ogsmith: "Built in, with significance" },
  { row: "See what each platform shows", diy: "Separate tools per platform", ogsmith: "Link checker for 7 platforms" },
];

const n = (v: number) => v.toLocaleString("en-US");

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Why not build it myself with @vercel/og?",
    a: "If you're on Next.js and enjoy tuning layouts, that's a fine choice. OGsmith is for when you'd rather not maintain it: it works on any stack, reads cards straight from your pages, handles cache refresh after a redesign, and gives non-developers an editor.",
  },
  {
    q: "Does it need a headless browser or a build step?",
    a: "No. Rendering happens on OGsmith's side with satori, and your site only needs to output one meta tag. Nothing is generated at build time.",
  },
  {
    q: "Can someone else use my key from the image URL?",
    a: "Keys in image URLs are visible in your pages. If that matters, use signed URLs instead: the signature covers the exact parameters, so nobody can change the card or reuse the link for other images.",
  },
  {
    q: "What happens when I hit my quota?",
    a: "New renders return an error until the 1st, and cards platforms have already cached keep working. There are no overage charges, and the usage endpoint lets you watch it from your own monitoring.",
  },
  {
    q: "What does it cost?",
    a: `Free covers ${n(PLANS.free.monthlyRenders)} renders a month, with no watermark for ${TRIAL_DAYS} days. Pro is $${PLANS.pro.priceMonthlyUsd}/month for ${n(PLANS.pro.monthlyRenders)} renders and Scale is $${PLANS.scale.priceMonthlyUsd}/month for ${n(PLANS.scale.monthlyRenders)}. There are no overage charges.`,
  },
];

export default function ForDevelopersPage() {
  const base = appUrl().replace(/\/$/, "");
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-balance text-[1.75rem] font-bold leading-tight sm:text-4xl">
          Social cards from one GET request
        </h1>
        <p className="mt-4 max-w-2xl text-pretty leading-relaxed text-zinc-400">
          Point your og:image tag at OGsmith and get a 1200×630 PNG back. There&apos;s no headless
          browser to run and no layout code to maintain, and it works on any stack that can set a
          meta tag.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-zinc-950 hover:bg-indigo-500"
          >
            Get a free API key
          </Link>
          <Link
            href="/docs"
            className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:border-zinc-500"
          >
            Read the docs
          </Link>
        </div>

        <section className="mt-14">
          <h2 className="text-xl font-bold">The whole integration</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Set parameters yourself:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm leading-relaxed text-emerald-400">
            {`GET ${base}/api/og?key=og_yourkey&template=split&title=My%20post&site=myblog.com&accent=%23ff6a2b
→ image/png, 1200×630`}
          </pre>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Or let OGsmith read the page, so the tag is the same in every template:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm leading-relaxed text-emerald-400">
            {`<meta property="og:image"
  content="${base}/api/og?key=og_yourkey&url=PAGE_URL" />`}
          </pre>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-bold">What you don&apos;t have to build</h2>
          <dl className="mt-6 grid gap-x-10 gap-y-7 sm:grid-cols-2">
            {BUILT_IN.map((item) => (
              <div key={item.title}>
                <dt className="font-semibold text-zinc-100">{item.title}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-zinc-400">
                  {item.body}{" "}
                  <Link href={item.href} className="text-indigo-400 underline-offset-4 hover:underline">
                    Docs
                  </Link>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-bold">Where it plugs in</h2>
          <div className="mt-6 grid gap-8 sm:grid-cols-2">
            <div>
              <h3 className="font-semibold text-zinc-100">WordPress</h3>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                The OGsmith plugin gives every post and page a card from its title and excerpt,
                works next to Yoast SEO and Rank Math, and keeps your signing secret on the server.{" "}
                <Link
                  href="/blog/wordpress-og-image#plugin"
                  className="text-indigo-400 underline-offset-4 hover:underline"
                >
                  Install guide
                </Link>
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-zinc-100">Claude and other MCP clients</h3>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                Render cards, run batches and check usage from a conversation.
              </p>
              <pre className="mt-3 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-xs leading-relaxed text-emerald-400">
                {`claude mcp add ogsmith -e OGSMITH_API_KEY=og_... -- npx -y ogsmith-mcp`}
              </pre>
            </div>
          </div>
          <p className="mt-6 text-sm text-zinc-400">
            Framework guides:{" "}
            <Link href="/blog/nextjs-og-image" className="text-indigo-400 hover:underline">
              Next.js
            </Link>
            ,{" "}
            <Link href="/blog/astro-og-image" className="text-indigo-400 hover:underline">
              Astro
            </Link>
            ,{" "}
            <Link href="/blog/webflow-og-image" className="text-indigo-400 hover:underline">
              Webflow
            </Link>
            .
          </p>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-bold">Build it yourself, or use OGsmith?</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            @vercel/og is free and good. Here&apos;s what you&apos;d be signing up to maintain.{" "}
            <Link href="/vs/vercel-og" className="text-indigo-400 underline-offset-4 hover:underline">
              Full comparison
            </Link>
          </p>
          <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="bg-zinc-900 text-zinc-400">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    <span className="sr-only">Compared on</span>
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Do it yourself
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium text-indigo-300">
                    OGsmith
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {COMPARISON.map((r) => (
                  <tr key={r.row}>
                    <th scope="row" className="px-4 py-3 font-medium text-zinc-200">
                      {r.row}
                    </th>
                    <td className="px-4 py-3 text-zinc-400">{r.diy}</td>
                    <td className="px-4 py-3 text-zinc-200">{r.ogsmith}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-bold">Questions</h2>
          <div className="mt-4 flex flex-col gap-3">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-sm font-medium text-zinc-100">
                  {q}
                  <span aria-hidden="true" className="text-zinc-400 transition-transform group-open:rotate-45">
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

        <section className="mt-12 rounded-xl border border-indigo-500/40 bg-indigo-500/5 p-6">
          <h2 className="text-lg font-semibold">Your first card in five minutes</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Sign up, copy your key and paste one tag. Renders are clean for the first {TRIAL_DAYS}{" "}
            days on the Free plan.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-zinc-950 hover:bg-indigo-500"
            >
              Get a free API key
            </Link>
            <Link
              href="/check"
              className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:border-zinc-500"
            >
              Check a link first
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
