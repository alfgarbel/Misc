"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface ExperimentSummary {
  id: string;
  name: string;
  slug: string;
  status: string;
  updatedAt: string;
  totals: Array<{ variantId: string; label: string; keys: number; conversions: number }>;
}

export default function ExperimentList({
  initial,
  limit,
  planName,
}: {
  initial: ExperimentSummary[];
  limit: number;
  planName: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled experiment" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not create an experiment");
        return;
      }
      router.push(`/dashboard/experiments/${data.experiment.id}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, name: string) {
    if (
      !window.confirm(
        `Delete "${name}"? Its results and every page assignment go with it, and pages already shared will fall back to their normal card.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/experiments/${id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((e) => e.id !== id));
      router.refresh();
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-zinc-500">
          {items.length} of {limit} on the {planName} plan
        </span>
        <button
          onClick={create}
          disabled={busy || items.length >= limit}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? "Creating…" : "New experiment"}
        </button>
      </div>
      {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center">
          <p className="text-sm text-zinc-400">
            No experiments yet. Create one to serve different card designs to
            different pages and compare how they do.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 [&>*]:min-w-0">
          {items.map((e) => {
            const pages = e.totals.reduce((n, t) => n + t.keys, 0);
            const outcomes = e.totals.reduce((n, t) => n + t.conversions, 0);
            return (
              <li
                key={e.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <a
                    href={`/dashboard/experiments/${e.id}`}
                    className="min-w-0 truncate font-medium text-white hover:text-indigo-300"
                  >
                    {e.name}
                  </a>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs ${
                      e.status === "running"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border-zinc-700 bg-zinc-950 text-zinc-400"
                    }`}
                  >
                    {e.status}
                  </span>
                </div>
                <code className="mt-1 block truncate text-xs text-emerald-400">
                  ?exp={e.slug}
                </code>
                <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                  <span>
                    {pages} {pages === 1 ? "page" : "pages"} · {outcomes}{" "}
                    {outcomes === 1 ? "outcome" : "outcomes"}
                  </span>
                  <button
                    onClick={() => remove(e.id, e.name)}
                    className="hover:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
