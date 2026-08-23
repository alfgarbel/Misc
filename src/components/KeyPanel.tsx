"use client";

import { useEffect, useState } from "react";

export default function KeyPanel({ keyPrefix }: { keyPrefix: string | null }) {
  const [plaintextKey, setPlaintextKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // One-time pickup of the plaintext key handed over from the signup flow.
    // sessionStorage isn't available during SSR, so this must run post-mount;
    // the resulting single re-render is intentional.
    try {
      const k = sessionStorage.getItem("ogsmith:newKey");
      if (k) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPlaintextKey(k);
        sessionStorage.removeItem("ogsmith:newKey");
      }
    } catch {}
  }, []);

  async function rotate() {
    if (
      !window.confirm(
        "Generate a new key? Your current key stops working immediately."
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/keys/rotate", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.apiKey) {
        setPlaintextKey(data.apiKey);
        setCopied(false);
      }
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!plaintextKey) return;
    try {
      await navigator.clipboard.writeText(plaintextKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h2 className="mb-1 font-semibold">API key</h2>
      {plaintextKey ? (
        <>
          <p className="mb-3 text-sm text-amber-400">
            Copy this key now — it won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-emerald-400">
              {plaintextKey}
            </code>
            <button
              onClick={copy}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:border-zinc-500"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </>
      ) : keyPrefix ? (
        <p className="mb-3 text-sm text-zinc-400">
          Your active key starts with{" "}
          <code className="rounded bg-zinc-950 px-2 py-0.5 text-emerald-400">
            {keyPrefix}…
          </code>
          . The full key is only shown once, when created.
        </p>
      ) : (
        <p className="mb-3 text-sm text-zinc-400">
          No active key. Generate one below.
        </p>
      )}
      <button
        onClick={rotate}
        disabled={busy}
        className="mt-4 rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:border-zinc-500 disabled:opacity-50"
      >
        {busy ? "Working…" : keyPrefix ? "Rotate key" : "Generate key"}
      </button>
    </div>
  );
}
