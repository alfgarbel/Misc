import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { PLANS } from "@/lib/plans";
import { TRIAL_DAYS } from "@/lib/trial";
import { jsonLdScript } from "@/lib/llms";

const TITLE = "Social cards for marketing teams, without waiting on developers";
const DESCRIPTION =
  "Design your link previews in a visual editor, test which design gets more clicks, and change your design without new shares showing the old card. Your developer adds one tag, once.";

export const metadata: Metadata = {
  title: { absolute: `${TITLE} · OGsmith` },
  description: DESCRIPTION,
  alternates: { canonical: "/for/marketing" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/for/marketing" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

/** The jobs a content or growth team does today by hand, and what replaces them. */
const JOBS: Array<{ title: string; before: string; after: string }> = [
  {
    title: "Design it once, in your brand",
    before: "A new Canva export for every post, or one generic image on all of them.",
    after:
      "Lay out a card in the visual editor with your fonts, logo and colours. Every page fills in its own headline.",
  },
  {
    title: "Find out which design gets clicks",
    before: "Picking a style by gut feeling, and never knowing if it worked.",
    after:
      "Split your pages between two designs and read the result with a proper significance test.",
  },
  {
    title: "Rebrand without broken previews",
    before: "X, Slack and WhatsApp keep showing the old image every time a link is shared again.",
    after:
      "Changing a design or your logo moves your cache version up. After the site's next deploy, every new share gets the new artwork, even on platforms with no refresh tool.",
  },
  {
    title: "See what people will see",
    before: "Posting a link to a private channel to check how it looks.",
    after:
      "The free checker shows the preview on X, LinkedIn, Slack, Discord, WhatsApp, Facebook and iMessage, and what's wrong with it.",
  },
  {
    title: "Files when a tool needs them",
    before: "Exporting images one by one for the newsletter or the CMS media library.",
    after: "Upload a CSV, get every card back in a zip.",
  },
];

const STEPS: Array<{ who: string; title: string; body: string }> = [
  {
    who: "You",
    title: "Check your links",
    body: "Paste a post into the checker and see what each platform shows today, with the card OGsmith would give it.",
  },
  {
    who: "Your developer, once",
    title: "Add one tag",
    body: "One og:image tag in the site's template. With url= it reads each page's own title, so the tag never needs touching again.",
  },
  {
    who: "You, from then on",
    title: "Design, test and refresh",
    body: "Designs, tests and brand defaults all live in the dashboard. Code only comes back when you rebrand, and then it is a redeploy.",
  },
];

const n = (v: number) => v.toLocaleString("en-US");

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Do I need a developer at all?",
    a: "Once. Someone has to add one meta tag to your site's template, which takes a few minutes. On WordPress, Ghost or Webflow it goes in the theme or the site's custom code settings. After that, designing cards and running tests happen in the dashboard; a rebrand only needs a redeploy.",
  },
  {
    q: "Can I use our brand font and logo?",
    a: "Yes. Upload TTF, OTF or WOFF fonts and PNG, JPEG or GIF images in the editor and use them on your designs. On paid plans your logo can also appear on every built-in card.",
  },
  {
    q: "How does the A/B test work if a platform shows one image to everyone?",
    a: "It splits pages, not viewers: half your posts get design A and half get design B, and you compare the two groups. That answers which design works better across your content. Results come from your own analytics, which your developer connects once, and the dashboard won't call a winner until each side has enough pages and outcomes.",
  },
  {
    q: "We changed our branding. Will our links update?",
    a: "New shares will, if the tag includes your cache version. Changing a design, a brand default or your logo moves that version up, and after the site's next deploy every page has a new image address that X, Slack, Discord and WhatsApp fetch the next time the link is shared. Posts that were already out may keep the preview the platform stored when they were posted. None of those platforms offers any other way to refresh.",
  },
  {
    q: "Is this an AI image generator?",
    a: "No. OGsmith makes consistent cards from your designs and your page's own text. If you want one-off illustrations, an image model is the better tool.",
  },
  {
    q: "What does it cost?",
    a: `Free covers ${n(PLANS.free.monthlyRenders)} renders a month and ${PLANS.free.templates} custom design, with no watermark for ${TRIAL_DAYS} days. Pro is $${PLANS.pro.priceMonthlyUsd}/month for ${n(PLANS.pro.monthlyRenders)} renders, ${PLANS.pro.templates} designs and ${PLANS.pro.experiments} tests at once. There are no overage charges.`,
  },
];

export default function ForMarketingPage() {
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
          Every link you share gets a card that looks like you
        </h1>
        <p className="mt-4 max-w-2xl text-pretty leading-relaxed text-zinc-400">
          OGsmith makes the image people see when your posts are shared on X, LinkedIn, Slack and
          WhatsApp. Design it in your brand, test which version gets more clicks, and change it
          whenever you like. Your developer sets it up once, and your team handles the rest.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/check"
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-zinc-950 hover:bg-indigo-500"
          >
            Check how your links look
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:border-zinc-500"
          >
            Start free
          </Link>
        </div>

        <section className="mt-14">
          <h2 className="text-xl font-bold">What changes for your team</h2>
          <div className="mt-6 flex flex-col gap-3">
            {JOBS.map((j) => (
              <div key={j.title} className="rounded-xl border border-zinc-800 p-5">
                <h3 className="font-semibold text-zinc-100">{j.title}</h3>
                <div className="mt-3 grid gap-3 text-sm leading-relaxed sm:grid-cols-2">
                  <p className="text-zinc-400">
                    <span className="block text-xs uppercase tracking-wide text-zinc-400">Today</span>
                    {j.before}
                  </p>
                  <p className="text-zinc-300">
                    <span className="block text-xs uppercase tracking-wide text-indigo-400">With OGsmith</span>
                    {j.after}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-bold">How it works</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                <p className="text-xs uppercase tracking-wide text-indigo-400">
                  {i + 1} · {s.who}
                </p>
                <h3 className="mt-2 font-semibold text-zinc-100">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-14 rounded-xl border border-zinc-800 p-6">
          <h2 className="text-lg font-semibold">The one thing to send your developer</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Add this to the site&apos;s &lt;head&gt;, with the page&apos;s own address in{" "}
            <code className="text-zinc-300">url</code>, your design&apos;s name in{" "}
            <code className="text-zinc-300">tpl</code> and the cache version from the dashboard in{" "}
            <code className="text-zinc-300">v</code>, read from a setting so a rebrand only needs a
            redeploy. The key also comes from the dashboard.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm leading-relaxed text-emerald-400">
            {`<meta property="og:image"
  content="https://ogsmith.app/api/og?key=og_yourkey&tpl=your-design&v=CACHE_VERSION&url=PAGE_URL" />`}
          </pre>
          <p className="mt-3 text-sm text-zinc-400">
            Step-by-step guides:{" "}
            <Link href="/blog/wordpress-og-image" className="text-indigo-400 hover:underline">
              WordPress
            </Link>
            ,{" "}
            <Link href="/blog/webflow-og-image" className="text-indigo-400 hover:underline">
              Webflow
            </Link>
            ,{" "}
            <Link href="/blog/nextjs-og-image" className="text-indigo-400 hover:underline">
              Next.js
            </Link>{" "}
            and{" "}
            <Link href="/blog/astro-og-image" className="text-indigo-400 hover:underline">
              Astro
            </Link>
            .
          </p>
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
          <h2 className="text-lg font-semibold">See your own links first</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Paste any post to see the card OGsmith would make for it. You don&apos;t need to sign up.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/check"
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-zinc-950 hover:bg-indigo-500"
            >
              Check a link
            </Link>
            <Link
              href="/pricing"
              className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:border-zinc-500"
            >
              See pricing
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
