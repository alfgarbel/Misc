"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import CopyBlock from "@/components/checker/CopyBlock";
import { TEMPLATES } from "@/lib/og/params";

/**
 * cover draws the page's own image, which only reaches the renderer through
 * ?url= with a key; in the demo it would show its no-image fallback and
 * undersell itself, so the picker leaves it out.
 */
const PICKABLE = TEMPLATES.filter((t) => t !== "cover");

/** Escapes a value for use inside a double-quoted HTML attribute. */
function attrEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The card OGsmith would give the checked page, in any built-in template.
 *
 * Switching template re-renders the preview and rewrites the tags below it,
 * so what someone copies is always the card they are looking at. Each switch
 * is one demo render; the demo limit is generous enough for all seven.
 */
export default function SuggestedCard({
  base,
  pageUrl,
  title,
  site,
  description,
  replacing,
  planNote,
}: {
  base: string;
  pageUrl: string;
  title: string;
  site: string;
  description: string | null;
  /** Whether the page already has an og:image these tags would replace. */
  replacing: boolean;
  /** One line on what the Free plan includes, worded on the server. */
  planNote: string;
}) {
  const [template, setTemplate] = useState<string>("gradient");
  // Starts "ready": the first image can finish loading before hydration,
  // and then onLoad never fires, which would leave it dimmed for good.
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("ready");
  // Bumped to retry a failed preview; v changes the URL but not the card.
  const [attempt, setAttempt] = useState(0);

  const params = useMemo(() => {
    const p = new URLSearchParams({ template, title, site });
    if (description) p.set("subtitle", description);
    return p.toString();
  }, [template, title, site, description]);

  const metaTags = [
    `<meta property="og:title" content="${attrEscape(title)}">`,
    description ? `<meta property="og:description" content="${attrEscape(description)}">` : null,
    `<meta property="og:image" content="${attrEscape(`${base}/api/og?key=YOUR_KEY&${params}`)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:url" content="${attrEscape(pageUrl)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ]
    .filter(Boolean)
    .join("\n");

  function choose(t: string) {
    if (t === template) {
      if (status !== "failed") return;
      setAttempt((n) => n + 1);
    } else {
      setTemplate(t);
    }
    setStatus("loading");
  }

  const previewSrc = `/api/og?${params}${attempt > 0 ? `&v=${attempt}` : ""}`;

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Template" className="flex flex-wrap gap-2">
        {PICKABLE.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => choose(t)}
            aria-pressed={template === t}
            className={`rounded-lg border px-3 py-1.5 text-sm capitalize ${
              template === t
                ? "border-indigo-500 bg-indigo-500/10 text-white"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={previewSrc}
          src={previewSrc}
          alt={`A card OGsmith would generate for this page, ${template} template`}
          width={1200}
          height={630}
          onLoad={() => setStatus("ready")}
          onError={() => setStatus("failed")}
          className={`w-full rounded-xl border border-zinc-800 transition-opacity duration-200 ${
            status === "loading" ? "opacity-60" : "opacity-100"
          }`}
        />
        {status === "failed" ? (
          <p
            role="status"
            className="absolute inset-0 flex items-center justify-center rounded-xl bg-zinc-950/85 p-6 text-center text-sm text-zinc-300"
          >
            That preview didn&apos;t load, usually because of too many previews in a minute.
            Wait a moment and pick the template again.
          </p>
        ) : null}
      </div>

      <p className="text-sm text-zinc-400">
        Add these to your <code className="text-zinc-300">&lt;head&gt;</code>
        {replacing ? ", replacing what's there" : ""} and every share picks it up:
      </p>
      <CopyBlock code={metaTags} />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/signup?url=${encodeURIComponent(pageUrl)}`}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-zinc-950 hover:bg-indigo-500"
          >
            Get this card free
          </Link>
          <Link href="/docs" className="text-sm text-indigo-400 hover:underline">
            Read the docs
          </Link>
        </div>
        <p className="text-sm text-zinc-500">{planNote}</p>
      </div>
    </div>
  );
}
