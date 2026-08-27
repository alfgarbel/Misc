"use client";

import { useState } from "react";
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMeta(null);
    try {
      const res = await fetch("/api/url-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Couldn't read that page");
      else setMeta(data.meta);
    } catch {
      setError("Couldn't read that page");
    } finally {
      setBusy(false);
    }
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

      <form onSubmit={lookup} className="flex flex-wrap gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/blog/post"
          className="w-full min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 sm:w-auto"
        />
        <select
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
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
          disabled={busy || !url}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? "Reading…" : "Read page"}
        </button>
      </form>

      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

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
      <code className="block overflow-x-auto whitespace-nowrap rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-emerald-400">
        {snippet}
      </code>
    </div>
  );
}
