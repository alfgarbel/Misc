import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Playground from "@/components/Playground";
import { PLANS, VAT_NOTE, VAT_SHORT } from "@/lib/plans";
import { appUrl } from "@/lib/stripe";
import { TRIAL_DAYS } from "@/lib/trial";
import { SHOWCASE } from "@/lib/showcase";
import ShowcaseImage from "@/components/ShowcaseImage";
import { jsonLdScript, organizationJsonLd, softwareJsonLd } from "@/lib/llms";

// Set here, not in the layout, so other pages don't inherit "/" as theirs.
export const metadata: Metadata = { alternates: { canonical: "/" } };

/**
 * The three things a visitor of any background can picture, shown large.
 * Developer detail lives on /for/developers, so nothing here needs a
 * glossary.
 */
const FEATURES: Array<{
  title: string;
  body: string;
  note?: string;
  visual: "tag" | "brand" | "redesign";
}> = [
  {
    title: "Point it at your page",
    body: "Add one tag to your site's template with the page's address in it. OGsmith reads each page's own title and description, so every new post gets its card without anyone filling anything in.",
    visual: "tag",
  },
  {
    title: "Your brand, without a design tool",
    body: "Pick one of seven templates with your colours, or lay out your own card in the visual editor and upload your brand font. Titles stay readable at any length.",
    visual: "brand",
  },
  {
    title: "Change the design whenever you like",
    body: "Platforms keep the image they first fetched for each address, and most give you no way to clear it. OGsmith puts a version number in your image addresses: change your design, republish your site, and every new share picks up the new card.",
    note: "Posts that are already out may keep their old preview, depending on the platform.",
    visual: "redesign",
  },
];

/** Everything else, one line each, for the visitor who wants the full list. */
const ALSO_INCLUDED: Array<{ title: string; body: string }> = [
  {
    title: "A/B test designs",
    body: "Give half your pages one design and half another, and compare the clicks your analytics reports.",
  },
  {
    title: "Cards in bulk",
    body: "Upload a CSV and download every card in a zip.",
  },
  {
    title: "Bills you can predict",
    body: "Flat monthly quotas, no overage charges, and an email before you reach the limit.",
  },
  {
    title: "Works on any site",
    body: "Anything that can set a meta tag, with a plugin for WordPress.",
  },
  {
    title: "Fast and cached",
    body: "Cards render in milliseconds and are served from a CDN; cached fetches don't count.",
  },
  {
    title: "A checker for 7 platforms",
    body: "X, LinkedIn, Slack, Discord, WhatsApp, Facebook and iMessage.",
  },
];

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: "Check your link",
    body: "Paste a page and see what X, LinkedIn, Slack and WhatsApp show today, with the card OGsmith would give it.",
  },
  {
    title: "Add one tag",
    body: "Sign up and copy one tag from your dashboard into your site's template. It's a few minutes' work for whoever looks after the site, and only needed once.",
  },
  {
    title: "Every share gets a card",
    body: "The next time anyone shares the page, platforms fetch your card. Your dashboard tells you when the first one does.",
  },
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
    q: "What happens when the trial ends?",
    a: `For ${TRIAL_DAYS} days your cards render without a watermark. After that, new cards on the Free plan carry a small mark. Cards platforms have already cached keep their clean copy, so nothing you've shared changes overnight.`,
  },
  {
    q: "What happens if I hit my monthly quota?",
    a: "New renders return an error until the 1st, and cards platforms have already cached keep working. There are no overage charges. We email you at 80% and at 100%, and renders served from the CDN cache don't count.",
  },
  {
    q: "I changed my design. Why do old shares still show the old card?",
    a: "Platforms keep the image they first fetched for each address, and most won't let you clear it. OGsmith puts a version number in your image addresses. When you change a design the number goes up, and once your site republishes, every new share gets the new card. Posts that were already out may keep the preview the platform stored when they were posted.",
  },
];

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
          A year of shipping, written up:
        </p>
        {children}
      </div>
    </figure>
  );
}

function CardImage({
  slug,
  alt,
  sizes = "(min-width: 1024px) 640px, 100vw",
}: {
  slug: string;
  alt: string;
  sizes?: string;
}) {
  return (
    <ShowcaseImage
      slug={slug}
      alt={alt}
      sizes={sizes}
      className="h-auto w-full rounded-lg border border-zinc-800 shadow-xl shadow-black/40"
    />
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** Each feature shows its result: the tag and its card, the range of looks, a redesign. */
function FeatureVisual({ kind, base }: { kind: "tag" | "brand" | "redesign"; base: string }) {
  if (kind === "tag") {
    return (
      <div className="flex flex-col items-center gap-4">
        <pre className="w-full overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-xs leading-relaxed text-emerald-400 sm:text-sm">
          {`<meta property="og:image"
  content="${base}/api/og?key=…&url=PAGE_URL" />`}
        </pre>
        <ArrowIcon className="h-6 w-6 rotate-90 text-zinc-500" />
        <CardImage slug="blog" alt="The card OGsmith builds from a blog post's own title" />
      </div>
    );
  }
  if (kind === "brand") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="col-span-2">
          <CardImage slug="changelog" alt="Example card in the announce template" />
        </div>
        <CardImage
          slug="store"
          alt="Example card in the split template"
          sizes="(min-width: 1024px) 320px, 50vw"
        />
        <CardImage
          slug="podcast"
          alt="Example card in the quote template"
          sizes="(min-width: 1024px) 320px, 50vw"
        />
      </div>
    );
  }
  return (
    <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr] sm:gap-4">
      <figure className="flex flex-col gap-2">
        <CardImage
          slug="blog"
          alt="A blog post's card before the redesign"
          sizes="(min-width: 640px) 300px, 100vw"
        />
        <figcaption className="text-sm text-zinc-500">Before</figcaption>
      </figure>
      <ArrowIcon className="mx-auto h-6 w-6 rotate-90 text-zinc-500 sm:rotate-0" />
      <figure className="flex flex-col gap-2">
        <CardImage
          slug="blog-redesign"
          alt="The same post's card after the redesign"
          sizes="(min-width: 640px) 300px, 100vw"
        />
        <figcaption className="text-sm text-zinc-300">After, on the next share</figcaption>
      </figure>
    </div>
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdScript([organizationJsonLd(base), softwareJsonLd(base)]),
          }}
        />
        {/* Hero: the checker is the first thing to try, so it's a field here,
            not a link to another page. */}
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-20">
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight text-balance sm:text-6xl lg:text-7xl">
            Every link, <span className="text-indigo-500">forged</span> into a
            card
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
            When someone shares your page on X, LinkedIn, Slack or WhatsApp,
            OGsmith gives it a proper preview image instead of a bare link or
            a grey box.
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
              className="rounded-lg bg-indigo-600 px-6 py-3 font-medium text-zinc-950 hover:bg-indigo-500"
            >
              Check my link
            </button>
          </form>
          <p className="mt-3 text-sm text-zinc-400">
            It&apos;s free and needs no account. See what X, LinkedIn, Slack
            and WhatsApp show for it today.
          </p>
          <p className="mt-6 text-sm text-zinc-400">
            Setting it up for your team? See how it works{" "}
            <Link href="/for/marketing" className="font-medium text-indigo-400 underline-offset-4 hover:underline">
              for marketing teams
            </Link>{" "}
            or{" "}
            <Link href="/for/developers" className="font-medium text-indigo-400 underline-offset-4 hover:underline">
              for developers
            </Link>
            .
          </p>

          {/* A wall of real cards, one per kind of site, so the first screen
              shows the product's output rather than describing it. */}
          <div className="relative mx-auto mt-14 max-w-5xl">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
              {SHOWCASE.map((card, i) => (
                <figure
                  key={card.slug}
                  className={`overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl shadow-black/40 ${
                    i % 3 === 1 ? "md:translate-y-6" : ""
                  } ${i >= 4 ? "hidden md:block" : ""}`}
                >
                  <ShowcaseImage
                    slug={card.slug}
                    alt={`Example card for ${card.useCase.toLowerCase()}`}
                    sizes="(min-width: 768px) 330px, 50vw"
                    eager={i < 3}
                    className="h-auto w-full"
                  />
                </figure>
              ))}
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 -bottom-6 h-24 bg-gradient-to-t from-zinc-950 to-transparent"
            />
          </div>
        </section>

        {/* Before and after */}
        <section className="border-t border-zinc-800 bg-zinc-950 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              title="The same link, shared twice"
              sub="Without a preview image, most platforms show a bare link or a small grey box."
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
                    <p className="text-zinc-500">blog.acme.dev</p>
                    <p className="truncate text-zinc-300">
                      What we learned shipping 40 releases in a year
                    </p>
                  </div>
                </div>
              </SharedPost>
              <SharedPost label="With OGsmith" tone="good">
                <div className="overflow-hidden rounded-lg border border-zinc-700">
                  <ShowcaseImage
                    slug="blog"
                    alt="The same link with an OGsmith card"
                    sizes="(min-width: 768px) 520px, 100vw"
                    className="h-auto w-full"
                  />
                  <p className="px-3 py-2 text-sm text-zinc-500">blog.acme.dev</p>
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

        {/* Features: three things anyone can picture, then the rest in a list */}
        <section className="border-t border-zinc-800 bg-zinc-950 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading title="What you get" />
            <div className="flex flex-col gap-16 sm:gap-20">
              {FEATURES.map((f, i) => (
                <div
                  key={f.title}
                  className={`flex flex-col items-center gap-8 lg:gap-14 ${
                    i % 2 === 1 ? "lg:flex-row-reverse" : "lg:flex-row"
                  }`}
                >
                  <div className="w-full lg:w-5/12">
                    <h3 className="text-2xl font-bold tracking-tight text-balance text-white">
                      {f.title}
                    </h3>
                    <p className="mt-3 max-w-prose text-pretty leading-relaxed text-zinc-400">
                      {f.body}
                    </p>
                    {f.note ? (
                      <p className="mt-3 max-w-prose text-sm text-zinc-500">{f.note}</p>
                    ) : null}
                  </div>
                  <div className="w-full lg:w-7/12">
                    <FeatureVisual kind={f.visual} base={base} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-20 border-t border-zinc-800 pt-10">
              <h3 className="text-lg font-semibold text-white">Also included</h3>
              <dl className="mt-6 grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
                {ALSO_INCLUDED.map((item) => (
                  <div key={item.title}>
                    <dt className="font-medium text-zinc-100">{item.title}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-zinc-400">{item.body}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* Playground */}
        <section className="border-t border-zinc-800 bg-zinc-950 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              title="Try it live"
              sub="Pick a template, type a title and render a real card."
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
                    {plan.watermark
                      ? ` · no watermark for ${TRIAL_DAYS} days, then watermarked`
                      : " · no watermark"}
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
            dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd) }}
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
                className="rounded-lg bg-indigo-600 px-6 py-3 text-center font-medium text-zinc-950 hover:bg-indigo-500"
              >
                Check my link
              </Link>
              <Link
                href="/signup"
                className="rounded-lg border border-zinc-700 px-6 py-3 text-center font-medium text-zinc-300 hover:border-zinc-500"
              >
                Start free
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
