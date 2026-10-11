"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ONBOARD_URL_KEY } from "./RememberUrl";

type VerifyStatus = "live" | "no_image" | "not_ogsmith" | "other_account";

function Step({
  n,
  done,
  title,
  children,
}: {
  n: number;
  done: boolean;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span
        aria-hidden="true"
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
          done
            ? "bg-emerald-500/20 text-emerald-300"
            : "border border-zinc-700 text-zinc-400"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className={`font-medium ${done ? "text-zinc-400" : "text-zinc-100"}`}>
          {title}
          <span className="sr-only">{done ? " (done)" : ""}</span>
        </h3>
        {children ? <div className="mt-3 flex flex-col gap-3">{children}</div> : null}
      </div>
    </li>
  );
}

/**
 * The three steps between signing up and having a card on a real page.
 *
 * It opens on the page the person checked before signing up when there is
 * one, so the first thing they see is their own card rather than an
 * example. The second step completes itself on the first render; the third
 * when a platform's crawler fetches the card, or when "Check my page" finds
 * it in the page's og:image.
 */
export default function ActivationChecklist({
  baseUrl,
  keyHint,
  savedUrl,
  rendered,
}: {
  baseUrl: string;
  /** The first key's prefix, for the tag when the full key isn't known. */
  keyHint: string;
  savedUrl: string | null;
  rendered: boolean;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(savedUrl ?? "");
  const [key, setKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ status: VerifyStatus | "error"; message: string } | null>(
    null
  );
  const objectUrl = useRef<string | null>(null);
  // Each preview reads the user's site, so an unchanged address isn't re-read.
  const previewed = useRef<string | null>(null);

  const renderPreview = useCallback(async (target: string) => {
    if (previewed.current === target) return;
    previewed.current = target;
    setPreviewError(null);
    try {
      const res = await fetch("/api/url-preview/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPreviewError(data.error ?? "We couldn't read that page.");
        previewed.current = null;
        return;
      }
      const next = URL.createObjectURL(await res.blob());
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = next;
      setPreview(next);
    } catch {
      setPreviewError("We couldn't reach that page.");
      previewed.current = null;
    }
  }, []);

  useEffect(() => {
    // Two one-time handovers from signup, both post-mount because
    // sessionStorage doesn't exist during SSR. The key is only read here:
    // KeysManager, further down, is what clears it.
    let carried: string | null = null;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setKey(sessionStorage.getItem("ogsmith:newKey"));
      carried = sessionStorage.getItem(ONBOARD_URL_KEY);
      sessionStorage.removeItem(ONBOARD_URL_KEY);
    } catch {}
    const start = savedUrl ?? carried;
    if (carried && !savedUrl) {
      setUrl(carried);
      void fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: carried }),
      });
    }
    if (start) void renderPreview(start);
  }, [savedUrl, renderPreview]);

  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    []
  );

  const pageForTag = url.trim() || "https://your-site.com/page";
  const tag = `<meta property="og:image" content="${baseUrl.replace(/\/$/, "")}/api/og?key=${
    key ?? keyHint
  }&url=${encodeURIComponent(pageForTag)}">`;

  async function copyTag() {
    try {
      await navigator.clipboard.writeText(tag);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setChecking(true);
    setResult(null);
    try {
      const res = await fetch("/api/onboarding/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult({ status: "error", message: data.error ?? "That check didn't work." });
        return;
      }
      setResult({ status: data.status, message: data.message });
      if (data.status === "live") router.refresh();
    } catch {
      setResult({ status: "error", message: "We couldn't reach the server. Check your connection and try again." });
    } finally {
      setChecking(false);
    }
  }

  const live = result?.status === "live";

  return (
    <section
      aria-labelledby="activation-heading"
      className="rounded-xl border border-indigo-500/40 bg-indigo-500/5 p-4 sm:p-6"
    >
      <h2 id="activation-heading" className="font-semibold">
        Get your first card live
      </h2>
      <p className="mt-1 text-sm text-zinc-400">
        Three steps. Most people are done in five minutes.
      </p>

      <ol className="mt-6 flex flex-col gap-6">
        <Step n={1} done title="Create your account and API key" />

        <Step n={2} done={rendered || live} title="Paste one tag into your page's <head>">
          <label className="flex flex-col gap-1 text-sm text-zinc-400">
            Your page
            <input
              id="activation-url"
              type="text"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={() => url.trim() && void renderPreview(url.trim())}
              placeholder="your-site.com/blog/first-post"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none placeholder:text-zinc-600 focus:border-indigo-500"
            />
          </label>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="The card OGsmith builds for this page"
              width={1200}
              height={630}
              className="w-full max-w-xl rounded-lg border border-zinc-800"
            />
          ) : null}
          {previewError ? <p className="text-sm text-amber-300">{previewError}</p> : null}
          <div className="flex flex-col gap-2">
            <code className="block overflow-x-auto whitespace-nowrap rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-emerald-400">
              {tag}
            </code>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={copyTag}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-indigo-500"
              >
                {copied ? "Copied" : "Copy tag"}
              </button>
              <p className="text-xs text-zinc-500">
                {key
                  ? "This tag includes your new key. It's only shown once, so keep a copy."
                  : `Replace ${keyHint} with your full key from API keys below.`}
              </p>
            </div>
            <p className="text-xs text-zinc-500">
              With <code className="text-zinc-300">url=</code> OGsmith reads the
              page&apos;s own title and description. For a whole site, have
              your layout put each page&apos;s address there.
            </p>
          </div>
        </Step>

        <Step n={3} done={live} title="Confirm it's live">
          <form onSubmit={verify} className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={checking || !url.trim()}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium hover:border-zinc-500 disabled:opacity-50"
            >
              {checking ? "Checking…" : "Check my page"}
            </button>
            <p className="text-xs text-zinc-500">
              This can also complete on its own when X, LinkedIn, Slack or
              WhatsApp first fetch your card.
            </p>
          </form>
          {result ? (
            <p
              role="status"
              className={`text-sm ${result.status === "live" ? "text-emerald-300" : "text-amber-300"}`}
            >
              {result.message}
            </p>
          ) : null}
        </Step>
      </ol>
    </section>
  );
}
