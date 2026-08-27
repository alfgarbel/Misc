"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { csvToRows } from "@/lib/batches/csv";

export interface BatchSummary {
  id: string;
  name: string;
  status: string;
  total: number;
  done: number;
  failed: number;
  storeImages: boolean;
  retainUntil: string | null;
  createdAt: string;
}

const SAMPLE = `key,title,subtitle,template
launch-post,Introducing our new API,Ship cards in one request,gradient
pricing-update,Simpler pricing from today,Three plans and no surprises,minimal`;

export default function BatchPanel({
  initial,
  rowLimit,
  planName,
}: {
  initial: BatchSummary[];
  rowLimit: number;
  planName: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [csv, setCsv] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = csv.trim() ? csvToRows(csv) : null;
  const rowCount = parsed?.ok ? parsed.rows.length : 0;

  const refresh = useCallback(async () => {
    const res = await fetch("/api/batches");
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.batches ?? []);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!parsed?.ok) return;
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || "Batch", rows: parsed.rows }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not start that batch");
        return;
      }
      // Batches are worked a slice at a time, so keep asking until it is
      // done rather than leaving the user staring at a half-finished job.
      let state = data.batch;
      setProgress(`${state.done + state.failed} of ${state.total}`);
      while (!state.finished) {
        const next = await fetch(`/api/batches/${data.batch.id}/run`, {
          method: "POST",
        });
        const slice = await next.json().catch(() => ({}));
        if (!next.ok) {
          setError(slice.error ?? "Batch stopped partway");
          break;
        }
        state = slice;
        setProgress(`${slice.done + slice.failed} of ${slice.total}`);
      }
      setCsv("");
      setName("");
      await refresh();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, label: string) {
    if (!window.confirm(`Delete "${label}" and its rendered cards?`)) return;
    const res = await fetch(`/api/batches/${id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((b) => b.id !== id));
      router.refresh();
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-6">
      <h2 className="mb-1 font-semibold">Batches</h2>
      <p className="mb-4 text-sm text-zinc-400">
        Render many cards at once and download them as a zip — for a CMS media
        library, an email tool, or an archive. Cards you serve from a URL
        don&apos;t need this; it&apos;s for when you need the files themselves.
      </p>

      <form onSubmit={submit} className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Batch name"
            className="w-full min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 sm:w-auto"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:border-zinc-500"
          >
            Load CSV
          </button>
          <button
            type="button"
            onClick={() => setCsv(SAMPLE)}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:border-zinc-500"
          >
            Use an example
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) setCsv(await file.text());
            e.target.value = "";
          }}
        />
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={6}
          spellCheck={false}
          placeholder={SAMPLE}
          className="w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-white outline-none focus:border-indigo-500"
        />
        <p className="text-xs text-zinc-500">
          First row names the columns. A <code className="text-zinc-400">key</code>{" "}
          column names each card; every other column is a render parameter —{" "}
          <code className="text-zinc-400">title</code>,{" "}
          <code className="text-zinc-400">template</code>,{" "}
          <code className="text-zinc-400">size</code>,{" "}
          <code className="text-zinc-400">url</code>, and so on.
        </p>

        {parsed && !parsed.ok ? (
          <p className="text-sm text-red-400">{parsed.error}</p>
        ) : null}
        {parsed?.ok && rowCount > rowLimit ? (
          <p className="text-sm text-amber-300">
            {rowCount} rows — the {planName} plan allows {rowLimit} per batch.
          </p>
        ) : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy || !parsed?.ok || rowCount === 0 || rowCount > rowLimit}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy ? "Rendering…" : `Render ${rowCount || ""} ${rowCount === 1 ? "card" : "cards"}`.trim()}
          </button>
          {progress ? (
            <span className="text-sm text-zinc-400">{progress} rendered</span>
          ) : null}
          <span className="text-xs text-zinc-500">
            Counts against your monthly render quota.
          </span>
        </div>
      </form>

      {items.length > 0 ? (
        <ul className="mt-6 space-y-2 border-t border-zinc-800 pt-4">
          {items.map((b) => {
            const downloadable =
              b.status === "completed" && b.storeImages && b.done > 0;
            return (
              <li
                key={b.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm"
              >
                <span className="min-w-0 flex-1 truncate text-zinc-200">{b.name}</span>
                <span className="text-xs text-zinc-500">
                  {b.done}/{b.total} rendered
                  {b.failed > 0 ? ` · ${b.failed} failed` : ""}
                </span>
                {downloadable ? (
                  // Retention is enforced by the endpoint, which says plainly
                  // when a batch's images have expired rather than the page
                  // guessing from a clock it cannot trust.
                  <a
                    href={`/api/batches/${b.id}/download`}
                    className="text-xs text-indigo-400 hover:underline"
                  >
                    Download zip
                  </a>
                ) : (
                  <span className="text-xs text-zinc-600">{b.status}</span>
                )}
                <button
                  onClick={() => remove(b.id, b.name)}
                  className="text-xs text-zinc-500 hover:text-red-400"
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
