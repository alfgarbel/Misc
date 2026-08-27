"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface WebhookSummary {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  lastStatus: string | null;
  lastDeliveredAt: string | null;
}

export default function WebhookPanel({
  initial,
  limit,
  planName,
}: {
  initial: WebhookSummary[];
  limit: number;
  planName: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSecret(null);
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not add that endpoint");
        return;
      }
      setSecret(data.webhook.secret);
      setUrl("");
      const listed = await fetch("/api/webhooks");
      if (listed.ok) setItems((await listed.json()).webhooks ?? []);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, label: string) {
    if (!window.confirm(`Stop sending events to ${label}?`)) return;
    const res = await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((w) => w.id !== id));
      router.refresh();
    }
  }

  async function toggle(id: string, active: boolean) {
    const res = await fetch(`/api/webhooks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    if (res.ok) {
      setItems((prev) => prev.map((w) => (w.id === id ? { ...w, active } : w)));
      router.refresh();
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-6">
      <h2 className="mb-1 font-semibold">Webhooks</h2>
      <p className="mb-4 text-sm text-zinc-400">
        We POST to your endpoint when something finishes — a batch completing,
        or your usage crossing a threshold. Every request is signed, so you can
        tell it came from us.
      </p>

      <form onSubmit={add} className="flex flex-wrap gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/hooks/ogsmith"
          className="w-full min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 sm:w-auto"
        />
        <button
          type="submit"
          disabled={busy || !url.trim() || items.length >= limit}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add endpoint"}
        </button>
      </form>
      <p className="mt-2 text-xs text-zinc-500">
        {items.length} of {limit} on the {planName} plan. Must be a public
        https address — private and internal addresses are refused.
      </p>
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}

      {secret ? (
        <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
          <p className="mb-2 text-sm text-emerald-200">
            Signing secret — copy it now, it isn&apos;t shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded bg-zinc-950 px-3 py-2 text-xs text-emerald-400">
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
              className="shrink-0 rounded-lg border border-zinc-700 px-3 py-2 text-xs hover:border-zinc-500"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {items.map((w) => (
            <li
              key={w.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm"
            >
              <span className="min-w-0 flex-1 truncate text-zinc-300">{w.url}</span>
              {w.lastStatus ? (
                <span
                  className={`text-xs ${
                    w.lastStatus === "delivered"
                      ? "text-emerald-400"
                      : w.lastStatus === "failed"
                        ? "text-red-400"
                        : "text-amber-300"
                  }`}
                >
                  {w.lastStatus}
                </span>
              ) : (
                <span className="text-xs text-zinc-600">no deliveries yet</span>
              )}
              <button
                onClick={() => toggle(w.id, !w.active)}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                {w.active ? "Pause" : "Resume"}
              </button>
              <button
                onClick={() => remove(w.id, w.url)}
                className="text-xs text-zinc-500 hover:text-red-400"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
