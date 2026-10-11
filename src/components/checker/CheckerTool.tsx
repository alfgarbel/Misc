import Link from "next/link";
import { headers } from "next/headers";
import PlatformPreviews from "@/components/checker/PlatformPreviews";
import CopyBlock from "@/components/checker/CopyBlock";
import { cachedReport, checkUrl, coerceUrl } from "@/lib/checker";
import type { Finding, Severity } from "@/lib/checker";
import { makeRateLimiter, clientIp } from "@/lib/ratelimit";
import { appUrl } from "@/lib/stripe";
import { getDb } from "@/lib/db";
import { recordEvent } from "@/lib/funnel";
import { TRIAL_DAYS } from "@/lib/trial";

/**
 * Reading someone else's server is not free, and this page needs no login.
 * A window this size is generous for a person and useless as a scanner.
 */
const checkLimiter = makeRateLimiter(10);

const TONE: Record<Severity, { chip: string; border: string; label: string }> = {
  error: {
    chip: "bg-red-500/15 text-red-300",
    border: "border-red-500/30",
    label: "Broken",
  },
  warning: {
    chip: "bg-amber-500/15 text-amber-300",
    border: "border-amber-500/30",
    label: "Costing you",
  },
  note: {
    chip: "bg-zinc-500/15 text-zinc-300",
    border: "border-zinc-700",
    label: "Worth knowing",
  },
};

function FindingCard({ finding }: { finding: Finding }) {
  const tone = TONE[finding.severity];
  return (
    <li className={`rounded-xl border ${tone.border} bg-zinc-900/50 p-4`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone.chip}`}>
          {tone.label}
        </span>
        <h3 className="text-sm font-semibold text-zinc-100">{finding.title}</h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{finding.detail}</p>
    </li>
  );
}

/**
 * "We couldn't look" and "we looked, and it's broken" are different
 * outcomes, and they used to be the same red panel — so a perfectly valid
 * report reading "broken when shared" was mistaken for the tool erroring.
 * This one is deliberately neutral: nothing here is a judgement on the page.
 */
function CantCheck({ message, url }: { message: string; url: string }) {
  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5">
      <p className="text-base font-semibold text-zinc-100">
        We couldn&apos;t check that page
      </p>
      <p className="mt-2 text-sm text-zinc-400">{message}</p>
      <p className="mt-3 break-all font-mono text-xs text-zinc-600">{url}</p>
    </div>
  );
}

function UrlForm({ defaultValue, action }: { defaultValue?: string; action: string }) {
  return (
    <form action={action} method="get" className="flex flex-col gap-3 sm:flex-row">
      {/* Deliberately not type="url": that refuses "ogsmith.app" in the
          browser before the server ever sees it, and a bare domain is what
          people type. coerceUrl works out what was meant. */}
      <input
        type="text"
        name="url"
        required
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        defaultValue={defaultValue}
        placeholder="ogsmith.app/pricing"
        aria-label="Page URL to check"
        className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-indigo-500"
      />
      <button
        type="submit"
        className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-zinc-950 hover:bg-indigo-500"
      >
        Check the link
      </button>
    </form>
  );
}

/** Escapes a value for use inside a double-quoted HTML attribute. */
function attrEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The checker itself: the form, and the report once a URL is given. /check
 * and each platform page (/check/twitter-card-validator…) render it, the
 * latter submitting to themselves and showing their platform first.
 */
export default async function CheckerTool({
  url,
  action = "/check",
  focus,
}: {
  url?: string;
  /** Where the form submits, so a platform page keeps its own results. */
  action?: string;
  /** Platform preview ids to show first. */
  focus?: string[];
}) {
  const base = appUrl().replace(/\/$/, "");
  // What the person typed may be a bare domain; this is what we'll fetch.
  const target = url ? coerceUrl(url) : null;

  let body: React.ReactNode;

  if (!url) {
    body = (
      <div className="flex flex-col gap-4">
        <UrlForm action={action} />
        <p className="text-sm text-zinc-500">
          You don&apos;t need an account. Paste any public page and see what X,
          LinkedIn, Slack, Discord, WhatsApp, Facebook and iMessage will show.
        </p>
      </div>
    );
  } else if (!target) {
    body = (
      <div className="flex flex-col gap-4">
        <UrlForm defaultValue={url} action={action} />
        <CantCheck
          url={url}
          message="That doesn't look like a web address. A domain on its own is fine. Try something like ogsmith.app/pricing."
        />
      </div>
    );
  } else if (
    // A cache hit reads nobody's server, so it doesn't spend the limit.
    !cachedReport(target) &&
    checkLimiter.limited(clientIp(await headers()))
  ) {
    body = (
      <div className="flex flex-col gap-4">
        <UrlForm defaultValue={url} action={action} />
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          That&apos;s a lot of checks in one minute. Wait sixty seconds and
          try again. Each check reads someone else&apos;s server, so we limit
          how often it runs.
        </p>
      </div>
    );
  } else {
    const report = await checkUrl(target);
    if (report.ok) await recordEvent(getDb(), "check_run");

    if (!report.ok) {
      body = (
        <div className="flex flex-col gap-4">
          <UrlForm defaultValue={url} action={action} />
          <CantCheck url={target} message={report.message} />
        </div>
      );
    } else {
      const { meta, diagnosis, tags, image } = report;
      const title = meta.title ?? meta.domain;
      const site = meta.siteName ?? meta.domain;

      // Every finding is accounted for, or the tally contradicts the
      // "What's wrong (n)" heading a few centimetres below it.
      const count = (s: Severity) =>
        diagnosis.findings.filter((f) => f.severity === s).length;
      const tally = (
        [
          [count("error"), "broken"],
          [count("warning"), "costing you clicks"],
          [count("note"), "worth knowing"],
        ] as const
      )
        .filter(([n]) => n > 0)
        .map(([n, label]) => `${n} ${label}`)
        .join(" · ");

      const verdict = {
        broken: {
          text: "This link is broken when shared",
          className: "border-red-500/40 bg-red-500/10 text-red-200",
        },
        degraded: {
          text: "This link works, but it's leaving clicks behind",
          className: "border-amber-500/40 bg-amber-500/10 text-amber-200",
        },
        good: {
          text: "This link previews correctly everywhere we checked",
          className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
        },
      }[diagnosis.verdict];

      // http:// and https:// spellings of the same site land on the same
      // page, so they produce the same report. Saying where we ended up is
      // the difference between that looking correct and looking stuck.
      const redirected = report.pageUrl !== target;

      const suggested = new URLSearchParams({
        template: "gradient",
        title,
        site,
      });
      if (meta.description) suggested.set("subtitle", meta.description);

      const metaTags = [
        `<meta property="og:title" content="${attrEscape(title)}">`,
        meta.description
          ? `<meta property="og:description" content="${attrEscape(meta.description)}">`
          : null,
        `<meta property="og:image" content="${attrEscape(`${base}/api/og?key=YOUR_KEY&${suggested.toString()}`)}">`,
        `<meta property="og:image:width" content="1200">`,
        `<meta property="og:image:height" content="630">`,
        `<meta property="og:url" content="${attrEscape(report.pageUrl)}">`,
        `<meta name="twitter:card" content="summary_large_image">`,
      ]
        .filter(Boolean)
        .join("\n");

      body = (
        <div className="flex flex-col gap-10">
          <UrlForm defaultValue={url} action={action} />

          <div className={`rounded-xl border p-5 ${verdict.className}`}>
            <p className="text-lg font-semibold">{verdict.text}</p>
            {tally ? <p className="mt-1 text-sm opacity-90">{tally}</p> : null}
            <p className="mt-3 break-all font-mono text-xs opacity-70">
              {report.pageUrl}
            </p>
            {redirected ? (
              <p className="mt-1 break-all text-xs opacity-60">
                followed from {target}
              </p>
            ) : null}
          </div>

          {diagnosis.findings.length > 0 ? (
            <section className="flex flex-col gap-4">
              <h2 className="text-xl font-bold">
                What&apos;s wrong{" "}
                <span className="font-normal text-zinc-500">
                  ({diagnosis.findings.length})
                </span>
              </h2>
              <ul className="flex flex-col gap-3">
                {diagnosis.findings.map((f) => (
                  <FindingCard key={f.id} finding={f} />
                ))}
              </ul>
            </section>
          ) : null}

          {diagnosis.passed.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-xl font-bold">What&apos;s already right</h2>
              <ul className="flex flex-col gap-1.5 text-sm text-zinc-400">
                {diagnosis.passed.map((p) => (
                  <li key={p} className="flex items-start gap-2">
                    <span className="mt-0.5 text-emerald-400">✓</span>
                    {p}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-bold">How it looks on each platform</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Same image, eight different crops.
              </p>
            </div>
            <PlatformPreviews
              imageUrl={image?.ok ? meta.imageUrl : null}
              title={title}
              description={meta.description}
              domain={meta.domain}
              focus={focus}
            />
          </section>

          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-bold">What it could look like</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Rendered from this page&apos;s own title and description. The
                small mark in the corner is the free tier&apos;s.
              </p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/og?${suggested.toString()}`}
              alt="A card OGsmith would generate for this page"
              width={1200}
              height={630}
              className="w-full rounded-xl border border-zinc-800"
            />
            <p className="text-sm text-zinc-400">
              Add these to your <code className="text-zinc-300">&lt;head&gt;</code>
              {tags.ogImage ? ", replacing what's there" : ""} and every share
              picks it up:
            </p>
            <CopyBlock code={metaTags} />
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/signup?url=${encodeURIComponent(report.pageUrl)}`}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-zinc-950 hover:bg-indigo-500"
              >
                Get this card free for {TRIAL_DAYS} days
              </Link>
              <Link href="/docs" className="text-sm text-indigo-400 hover:underline">
                Read the docs
              </Link>
            </div>
          </section>
        </div>
      );
    }
  }

  return body;
}
