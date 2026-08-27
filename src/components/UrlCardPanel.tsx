"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TEMPLATES } from "@/lib/og/params";

interface Meta {
  title: string | null;
  description: string | null;
  siteName: string | null;
  domain: string;
  hasImage: boolean;
}

export default function UrlCardPanel({
  baseUrl,
  apiKeyHint,
}: {
  baseUrl: string;
  apiKeyHint: string;
}) {
  const [url, setUrl] = useState("");
  const [template, setTemplate] = useState("link");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // The URL the current preview belongs to, so switching template can
  // re-render without needing the field to be resubmitted.
  const previewedUrl = useRef<string | null>(null);

  // Object URLs are revoked as they're replaced, and on unmount, so a long
  // session doesn't leak a blob per preview.
  const objectUrl = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    []
  );

  const showImage = useCallback((blob: Blob) => {
    const next = URL.createObjectURL(blob);
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = next;
    setPreview(next);
  }, []);

  const render = useCallback(
    async (target: string, tpl: string) => {
      setBusy(true);
      setError(null);
      try {
        const [metaRes, imgRes] = await Promise.all([
          fetch("/api/url-preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: target }),
          }),
          fetch("/api/url-preview/render", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: target, template: tpl }),
          }),
        ]);

        if (!imgRes.ok) {
          const data = await imgRes.json().catch(() => ({}));
          setError(data.error ?? "Couldn't build a card from that page");
          setMeta(null);
          setPreview(null);
          previewedUrl.current = null;
          return;
        }
        showImage(await imgRes.blob());
        previewedUrl.current = target;

        const data = await metaRes.json().catch(() => ({}));
        setMeta(metaRes.ok ? data.meta : null);
      } catch {
        setError("Couldn't build a card from that page");
      } finally {
        setBusy(false);
      }
    },
    [showImage]
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (url.trim()) void render(url.trim(), template);
  }

  function onTemplateChange(next: string) {
    setTemplate(next);
    // Re-render immediately if there's already a card on screen; the page
    // itself is cached, so this costs nothing outbound.
    if (previewedUrl.current) void render(previewedUrl.current, next);
  }

  const snippet = `${baseUrl}/api/og?key=${apiKeyHint}&template=${template}&url=${
    url ? encodeURIComponent(url) : "https://example.com/post"
  }`;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-6">
      <h2 className="mb-1 font-semibold">Card from a URL</h2>
      <p className="mb-4 text-sm text-zinc-400">
        Point <code className="rounded bg-zinc-950 px-1.5 py-0.5 text-emerald-400">&amp;url=</code>{" "}
        at any public page and OGsmith reads its title, description and image
        for you — no per-post parameters to wire up.
      </p>

      <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/blog/post"
          className="w-full min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 sm:w-auto"
        />
        <select
          value={template}
          onChange={(e) => onTemplateChange(e.target.value)}
          className="min-w-0 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        >
          {TEMPLATES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={busy || !url.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? "Rendering…" : "Preview card"}
        </button>
      </form>

      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

      {preview ? (
        <div className="mt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Preview of the card this URL produces"
            width={1200}
            height={630}
            className={`w-full rounded-lg border border-zinc-800 transition-opacity ${
              busy ? "opacity-50" : "opacity-100"
            }`}
          />
          <p className="mt-2 text-xs text-zinc-500">
            This is the image itself — the same bytes a crawler receives, your
            brand defaults and plan included.
          </p>
        </div>
      ) : null}

      {meta ? (
        <dl className="mt-4 space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm">
          {[
            ["Title", meta.title],
            ["Description", meta.description],
            ["Site", meta.siteName ?? meta.domain],
            ["Image", meta.hasImage ? "found on the page" : "none — a gradient is used"],
          ].map(([label, value]) => (
            <div key={label as string} className="flex flex-wrap gap-x-3">
              <dt className="w-24 shrink-0 text-zinc-500">{label}</dt>
              <dd className="min-w-0 flex-1 text-zinc-300">
                {value || <span className="text-zinc-600">not found</span>}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <p className="mt-4 mb-2 text-xs text-zinc-500">
        Then use it as your image URL:
      </p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-emerald-400">
          {snippet}
        </code>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(snippet);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {}
          }}
          className="shrink-0 rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:border-zinc-500"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
