"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RefreshPanel({
  version,
  brandUpdatedAt,
  needsRepublish,
  baseUrl,
}: {
  version: number;
  brandUpdatedAt: string | null;
  needsRepublish: boolean;
  baseUrl: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const snippet = `${baseUrl}/api/og?key=YOUR_KEY&title=Hello&v=${version}`;

  async function call(method: "POST" | "DELETE") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/brand/refresh", { method });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-6">
      <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="font-semibold">Cache refresh</h2>
        <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-0.5 text-xs text-zinc-400">
          version {version}
        </span>
      </div>
      <p className="mb-4 text-sm text-zinc-400">
        X, Slack, Discord and WhatsApp cache your card by URL and give you no
        way to clear it. Adding{" "}
        <code className="rounded bg-zinc-950 px-1.5 py-0.5 text-emerald-400">
          &amp;v={version}
        </code>{" "}
        changes the URL, so every platform fetches the image again. It has no
        effect on how the card renders.
      </p>

      {needsRepublish ? (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          Your brand settings changed
          {brandUpdatedAt
            ? ` on ${new Date(brandUpdatedAt).toLocaleDateString()}`
            : ""}
          . Links already shared still show the old artwork until they are
          re-shared with{" "}
          <code className="rounded bg-zinc-950 px-1.5 py-0.5 text-emerald-300">
            v={version}
          </code>{" "}
          in the URL.
        </div>
      ) : null}

      <div className="mb-4 flex items-center gap-2">
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

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => call("POST")}
          disabled={busy}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? "Working…" : "Force refresh"}
        </button>
        {needsRepublish ? (
          <button
            onClick={() => call("DELETE")}
            disabled={busy}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:border-zinc-500 disabled:opacity-50"
          >
            I&apos;ve republished
          </button>
        ) : null}
        {error ? <span className="text-sm text-red-400">{error}</span> : null}
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Signed URLs cover <code className="text-emerald-400">v</code> like any
        other parameter, so re-sign after bumping.
      </p>
    </div>
  );
}
