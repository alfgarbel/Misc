"use client";

import { useState } from "react";

export default function SigningPanel({ accountId }: { accountId: string }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load(rotate: boolean) {
    if (
      rotate &&
      !window.confirm(
        "Rotate the signing secret? All previously signed URLs stop working immediately."
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/signing-secret", {
        method: rotate ? "POST" : "GET",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.secret) {
        setSecret(data.secret);
        setCopied(false);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-6">
      <h2 className="mb-1 font-semibold">Signed URLs</h2>
      <p className="mb-4 text-sm text-zinc-400">
        Instead of putting your API key in image URLs, sign each URL with an
        HMAC so a leaked link can&apos;t be reused for other content. Your
        account ID is{" "}
        <code className="rounded bg-zinc-950 px-2 py-0.5 text-emerald-400">
          {accountId}
        </code>
        . See the{" "}
        <a href="/docs#signed-urls" className="text-indigo-400 hover:underline">
          docs
        </a>{" "}
        for the signing snippet.
      </p>
      {secret ? (
        <div className="mb-4 flex items-center gap-2">
          <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-emerald-400">
            {secret}
          </code>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(secret);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {}
            }}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:border-zinc-500"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      ) : null}
      <div className="flex gap-3">
        {!secret ? (
          <button
            onClick={() => load(false)}
            disabled={busy}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:border-zinc-500 disabled:opacity-50"
          >
            {busy ? "Loading…" : "Reveal signing secret"}
          </button>
        ) : null}
        <button
          onClick={() => load(true)}
          disabled={busy}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:border-zinc-500 disabled:opacity-50"
        >
          Rotate secret
        </button>
      </div>
    </div>
  );
}
