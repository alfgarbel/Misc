import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Playground from "@/components/Playground";
import { PLANS, VAT_NOTE, VAT_SHORT } from "@/lib/plans";
import { appUrl } from "@/lib/stripe";
import { TRIAL_DAYS } from "@/lib/trial";

const EXAMPLE_URL =
  "/api/og?template=gradient&title=Ship%20social%20cards%20without%20a%20designer&subtitle=One%20GET%20request.%20A%20perfect%201200%C3%97630%20image%20for%20every%20page.&site=ogsmith.app";

const FEATURE_GROUPS: Array<{
  name: string;
  blurb: string;
  items: Array<{ title: string; body: string }>;
}> = [
  {
    name: "Put it on your site",
    blurb: "One tag, any stack. No SDK, no build step.",
    items: [
      {
        title: "One GET request",
        body: "Point your <meta property=\"og:image\"> at a URL and you're done. Works from any language or framework.",
      },
      {
        title: "Point it at a URL",
        body: "Skip the parameters: give OGsmith a link and it reads the page's own title, description and image to build the card.",
      },
      {
        title: "Fast and serverless",
        body: "Images render in milliseconds with satori, no headless browser. Responses are CDN-cached, so repeat crawls are free.",
      },
    ],
  },
  {
    name: "Make it yours",
    blurb: "Look like your brand without opening a design tool.",
    items: [
      {
        title: "Templates that read well in a feed",
        body: "Six hand-tuned templates with themes and accent colors. Legible at any title length.",
      },
      {
        title: "Or design your own",
        body: "A visual editor for your own layouts: drag text, images and shapes, upload your brand font, and render it by name.",
      },
      {
        title: "Usage you can predict",
        body: "Flat monthly quotas and no overage charges. You'll see it on your dashboard, and by email, well before the limit.",
      },
    ],
  },
  {
    name: "Get more clicks",
    blurb: "Tools for after the card is live.",
    items: [
      {
        title: "Change your look after you ship",
        body: "X, Slack, Discord and WhatsApp cache your card and give you no way to clear it. Bump your cache version and every published link picks up the new artwork.",
      },
      {
        title: "Test which design wins",
        body: "Run one design against another across your pages and read the result with a proper significance test.",
      },
      {
        title: "Bulk when you need files",
        body: "Render a whole back catalogue from a CSV, download it as a zip, and get a signed webhook when it's done.",
      },
    ],
  },
];

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: "Check your link",
    body: "Paste a page and see what X, LinkedIn, Slack and WhatsApp show today, with the card OGsmith would give it.",
  },
  {
    title: "Paste one tag",
    body: "Sign up, copy the og:image tag from your dashboard and put it in your page's <head>. With url= there's nothing else to fill in.",
  },
  {
    title: "Every share gets a card",
    body: "The next time anyone shares the page, platforms fetch your card. Your dashboard tells you when the first one does.",
  },
];

/** Honest about where doing it yourself is the right call. */
const COMPARISON: Array<{ row: string; diy: string; ogsmith: string }> = [
  { row: "Cost", diy: "Free library, your hosting", ogsmith: `Free to start, from $${PLANS.pro.priceMonthlyUsd}/mo` },
  { row: "Time to first card", diy: "An afternoon of layout and font wrangling", ogsmith: "Five minutes" },
  { row: "Works outside your framework", diy: "Next.js and Vercel first", ogsmith: "Any site that can set a meta tag" },
  { row: "Cards from a page's own metadata", diy: "You write the scraper", ogsmith: "Built in, with url=" },
  { row: "Change designs after links are shared", diy: "You build cache-busting", ogsmith: "One click" },
  { row: "Design without code", diy: "No", ogsmith: "Visual editor" },
  { row: "A/B test designs", diy: "No", ogsmith: "Built in, with significance" },
  { row: "See what each platform shows", diy: "Separate tools per platform", ogsmith: "Link checker for 7 platforms" },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "What is an Open Graph image?",
    a: "It's the picture X, LinkedIn, Slack, WhatsApp, Discord and Facebook show when someone shares your link. It comes from the og:image tag in your page's <head>. Without one, most platforms show a bare link or a small grey box.",
  },
  {
    q: "Do I need to write code?",
    a: "You need to be able to add one meta tag to your pages. With url= OGsmith reads each page's title and description itself, so the tag is the same everywhere except for the page address. Most CMSs, including WordPress, Ghost and Webflow, let you set it in the page settings or the theme's <head>.",
  },
  {
    q: "Why not build it myself with @vercel/og?",
    a: "If you're on Next.js and enjoy tuning layouts, that's a fine choice. OGsmith is for when you'd rather not maintain it: it works on any stack, reads cards straight from your pages, lets you change designs after links are shared, and gives non-developers an editor.",
  },
  {
    q: "What happens when the trial ends?",
    a: `For ${TRIAL_DAYS} days your cards render without a watermark. After that, new cards on the Free plan carry a small mark. Cards platforms have already cached keep their clean copy, so nothing you've shared changes overnight.`,
  },
  {
    q: "What happens if I hit my monthly quota?",
    a: "New renders return an error until the 1st, and cards platforms have already cached keep working. There are no overage charges. We email you at 80% and at 100%, and renders served from the CDN cache don't count.",
  },
  {
    q: "I changed my design. Why do old shares still show the old card?",
    a: "Platforms cache a card per URL and most won't let you clear it. OGsmith adds a version number to your image URLs: bump it from the dashboard and every link picks up the new card the next time it's shared.",
  },
];

const BEFORE_AFTER_IMAGE =
  "/api/og?template=split&title=How%20we%20cut%20our%20build%20time%20in%20half&subtitle=Notes%20from%20moving%20CI%20to%20a%20monorepo&site=blog.example.com&accent=%23f43f5e";

function SectionHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-10 max-w-2xl">
      <h2 className="text-3xl font-bold tracking-tight text-balance">{title}</h2>
      {sub ? <p className="mt-2 text-zinc-400">{sub}</p> : null}
    </div>
  );
}

/** A post in a feed, as most platforms lay out a shared link. */
function SharedPost({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "bad" | "good";
  children: React.ReactNode;
}) {
  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <figcaption
        className={`w-fit rounded-full px-3 py-0.5 text-xs font-medium ${
          tone === "bad" ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"
        }`}
      >
        {label}
      </figcaption>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="mb-3 flex items-center gap-3">
          <span aria-hidden="true" className="h-9 w-9 rounded-full bg-zinc-700" />
          <div className="text-sm leading-tight">
            <p className="font-semibold text-zinc-200">You</p>
            <p className="text-zinc-500">@yourcompany · 2h</p>
          </div>
        </div>
        <p className="mb-3 text-sm text-zinc-300">
          We finally fixed our CI. Write-up here:
        </p>
        {children}
      </div>
    </figure>
  );
}

export default function Home() {
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
      <main>
        {/* Hero: the checker is the first thing to try, so it's a field here,
            not a link to another page. */}
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-20">
          <p className="mx-auto mb-4 w-fit rounded-full border border-indigo-500/40 bg-indigo-500/10 px-4 py-1 text-sm text-indigo-300">
            Open Graph images as an API
          </p>
          <h1 className="mx-auto max-w-3xl text-3xl font-bold leading-tight tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Social cards for every page,{" "}
            <span className="text-indigo-400">from one URL</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
            Stop shipping pages with blank link previews. OGsmith renders
            pixel-perfect 1200×630 Open Graph images on demand, with no
            headless browser, design tool or build step.
          </p>

          <form
            action="/check"
            method="get"
            className="mx-auto mt-8 flex max-w-xl flex-col gap-3 sm:flex-row"
          >
            <label htmlFor="hero-url" className="sr-only">
              Your page&apos;s address
            </label>
            <input
              id="hero-url"
              type="text"
              name="url"
              required
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Paste your page, e.g. yoursite.com/blog"
              className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none placeholder:text-zinc-500 focus:border-indigo-500"
            />
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-500"
            >
              Check my link
            </button>
          </form>
          <p className="mt-3 text-sm text-zinc-400">
            Free, no account. See what X, LinkedIn, Slack and WhatsApp show for
            it today.
          </p>
          <p className="mt-6 text-sm text-zinc-400">
            Already know you want it?{" "}
            <Link href="/signup" className="font-medium text-indigo-400 hover:underline">
              Get your free API key
            </Link>{" "}
            or{" "}
            <Link href="/docs" className="font-medium text-indigo-400 hover:underline">
              read the docs
            </Link>
            .
          </p>

          <div className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-xl border border-zinc-800 shadow-2xl shadow-indigo-500/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={EXAMPLE_URL}
              alt="Example Open Graph card generated by OGsmith"
              width={1200}
              height={630}
              className="w-full"
            />
          </div>
          <code className="mx-auto mt-4 block w-fit max-w-full overflow-x-auto whitespace-nowrap rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs text-emerald-400">
            &lt;meta property=&quot;og:image&quot;
            content=&quot;{base}/api/og?title=...&quot; /&gt;
          </code>
        </section>

        {/* Before and after */}
        <section className="border-t border-zinc-800 bg-zinc-950 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              title="The same link, shared twice"
              sub="Posts with a large image get noticed. Posts with a grey box get scrolled past."
            />
            <div className="grid gap-8 md:grid-cols-2">
              <SharedPost label="Without a card" tone="bad">
                <div className="flex overflow-hidden rounded-lg border border-zinc-700">
                  <div
                    aria-hidden="true"
                    className="flex w-24 shrink-0 items-center justify-center bg-zinc-800 text-2xl text-zinc-600"
                  >
                    ↗
                  </div>
                  <div className="min-w-0 p-3 text-sm">
                    <p className="text-zinc-500">blog.example.com</p>
                    <p className="truncate text-zinc-300">
                      How we cut our build time in half
                    </p>
                  </div>
                </div>
              </SharedPost>
              <SharedPost label="With OGsmith" tone="good">
                <div className="overflow-hidden rounded-lg border border-zinc-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={BEFORE_AFTER_IMAGE}
                    alt="The same link with an OGsmith card"
                    width={1200}
                    height={630}
                    loading="lazy"
                    className="w-full"
                  />
                  <p className="px-3 py-2 text-sm text-zinc-500">blog.example.com</p>
                </div>
              </SharedPost>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-zinc-800 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading title="How it works" />
            <ol className="grid gap-6 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-indigo-500/50 text-sm font-semibold text-indigo-300"
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold text-white">{step.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features, grouped by the job they do */}
        <section className="border-t border-zinc-800 bg-zinc-950 py-20">
          <div className="mx-auto flex max-w-6xl flex-col gap-14 px-4 sm:px-6">
            {FEATURE_GROUPS.map((group) => (
              <div key={group.name} className="grid gap-6 lg:grid-cols-[16rem_1fr]">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">{group.name}</h2>
                  <p className="mt-2 text-sm text-zinc-400">{group.blurb}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  {group.items.map((f) => (
                    <div
                      key={f.title}
                      className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5"
                    >
                      <h3 className="mb-2 font-semibold text-white">{f.title}</h3>
                      <p className="text-sm leading-relaxed text-zinc-400">{f.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Build vs buy */}
        <section className="border-t border-zinc-800 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              title="Build it yourself, or use OGsmith?"
              sub="@vercel/og is free and good. Here's what you'd be signing up to maintain."
            />
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
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
          </div>
        </section>

        {/* Playground */}
        <section className="border-t border-zinc-800 bg-zinc-950 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              title="Try it live"
              sub="Tweak the parameters and render a real image from the API."
            />
            <Playground />
          </div>
        </section>

        {/* Pricing teaser */}
        <section className="border-t border-zinc-800 py-20">
          <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
            <h2 className="mb-2 text-3xl font-bold">Simple pricing</h2>
            <p className="mb-10 text-zinc-400">
              Start free. Upgrade when your traffic does.
            </p>
            <div className="grid gap-6 sm:grid-cols-3">
              {Object.values(PLANS).map((plan) => (
                <div
                  key={plan.id}
                  className={`rounded-xl border p-6 text-left ${
                    plan.id === "pro"
                      ? "border-indigo-500 bg-indigo-500/5"
                      : "border-zinc-800 bg-zinc-900/50"
                  }`}
                >
                  <h3 className="font-semibold">{plan.name}</h3>
                  <p className="mt-2 text-3xl font-bold">
                    ${plan.priceMonthlyUsd}
                    <span className="text-base font-normal text-zinc-500">/mo</span>
                    {plan.priceMonthlyUsd > 0 ? (
                      <span className="ml-2 text-xs font-normal text-zinc-500">
                        {VAT_SHORT}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-3 text-sm text-zinc-400">
                    {plan.monthlyRenders.toLocaleString()} renders / month
                    {plan.watermark ? " · free trial, then watermarked" : " · no watermark"}
                  </p>
                </div>
              ))}
            </div>
            <p className="mx-auto mt-6 max-w-xl text-sm text-zinc-500">
              {VAT_NOTE}
            </p>
            <Link
              href="/pricing"
              className="mt-6 inline-block rounded-lg border border-zinc-700 px-6 py-3 font-medium text-zinc-300 hover:border-zinc-500"
            >
              Compare plans
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-zinc-800 bg-zinc-950 py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <SectionHeading title="Questions people ask first" />
            <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
              {FAQ.map(({ q, a }) => (
                <details key={q} className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-zinc-100">
                    {q}
                    <span
                      aria-hidden="true"
                      className="text-zinc-500 transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400">{a}</p>
                </details>
              ))}
            </div>
          </div>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
          />
        </section>

        {/* Closing call to action */}
        <section className="border-t border-zinc-800 py-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight text-balance">
              Find out what your links look like right now
            </h2>
            <p className="mt-3 text-zinc-400">
              It takes ten seconds and you don&apos;t need an account.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
              <Link
                href="/check"
                className="rounded-lg bg-indigo-600 px-6 py-3 text-center font-medium text-white hover:bg-indigo-500"
              >
                Check my link
              </Link>
              <Link
                href="/signup"
                className="rounded-lg border border-zinc-700 px-6 py-3 text-center font-medium text-zinc-300 hover:border-zinc-500"
              >
                Get your free API key
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
