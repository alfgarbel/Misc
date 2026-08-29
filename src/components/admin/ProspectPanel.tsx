"use client";

import { useCallback, useState } from "react";
import type { ProspectScanRow, ProspectItemRow } from "@/lib/db/schema";

type Row = ProspectItemRow & {
  email: { subject: string; body: string } | null;
};

const VERDICT_TONE: Record<string, string> = {
  broken: "bg-red-500/15 text-red-300",
  degraded: "bg-amber-500/15 text-amber-300",
  good: "bg-emerald-500/15 text-emerald-300",
};

function Chip({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      {children}
    </span>
  );
}

function Prospect({ scanId, row }: { scanId: string; row: Row }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!row.email) return;
    try {
      await navigator.clipboard.writeText(
        `Subject: ${row.email.subject}\n\n${row.email.body}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <li className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-medium text-zinc-100">{row.domain}</span>
        <Chip tone="bg-red-500/15 text-red-300">{row.findingId}</Chip>
        <a
          href={row.pageUrl ?? "#"}
          target="_blank"
          rel="noreferrer noopener"
          className="min-w-0 flex-1 truncate text-xs text-zinc-500 hover:text-zinc-300"
        >
          {row.pageUrl}
        </a>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs hover:border-zinc-500"
        >
          {open ? "Hide" : "Card & email"}
        </button>
      </div>

      {row.claim ? (
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          Their page {row.claim}.
        </p>
      ) : null}

      {open ? (
        <div className="mt-4 flex flex-col gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/prospects/${scanId}/card/${row.idx}`}
            alt={`The card ${row.domain} could have`}
            width={1200}
            height={630}
            className="w-full rounded-lg border border-zinc-800"
            loading="lazy"
          />
          {row.email ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-zinc-500">
                  Subject: <span className="text-zinc-300">{row.email.subject}</span>
                </span>
                <button
                  type="button"
                  onClick={copy}
                  className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs hover:border-zinc-500"
                >
                  {copied ? "Copied" : "Copy email"}
                </button>
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-300">
                {row.email.body}
              </pre>
              <p className="text-xs text-zinc-600">
                Right-click the card to save it, then attach it. You still need
                to find a real address — don&apos;t guess one.
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export default function ProspectPanel({
  initialScans,
}: {
  initialScans: ProspectScanRow[];
}) {
  const [scans, setScans] = useState(initialScans);
  const [sites, setSites] = useState("");
  const [name, setName] = useState("");
  const [tier, setTier] = useState<"strict" | "wide">("strict");
  const [signature, setSignature] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [openScan, setOpenScan] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [showAll, setShowAll] = useState(false);

  const loadRows = useCallback(
    async (id: string, sig: string) => {
      const res = await fetch(
        `/api/prospects/${id}?signature=${encodeURIComponent(sig || "— [your name]")}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setRows(data.rows ?? []);
      setScans((prev) => prev.map((s) => (s.id === id ? data.scan : s)));
    },
    []
  );

  // Loaded on the click rather than in an effect: the fetch is a response to
  // something the user did, not state to synchronise.
  async function selectScan(id: string) {
    if (openScan === id) {
      setOpenScan(null);
      setRows([]);
      return;
    }
    setOpenScan(id);
    setRows([]);
    await loadRows(id, signature);
  }

  async function startScan() {
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      const res = await fetch("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sites, name: name || undefined, tier }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't start the scan");
        return;
      }
      const scan: ProspectScanRow = data.scan;
      setScans((prev) => [scan, ...prev]);
      setOpenScan(scan.id);
      setSites("");

      // Worked through here rather than left to a queue: keep asking for the
      // next slice until the server says there is none.
      let state = { done: 0, total: scan.total, qualified: 0, finished: false };
      while (!state.finished) {
        const next = await fetch(`/api/prospects/${scan.id}/run`, {
          method: "POST",
        });
        if (!next.ok) {
          setError("The scan stopped early. Re-open it to carry on.");
          break;
        }
        state = await next.json();
        setProgress(
          `Read ${state.done} of ${state.total} — ${state.qualified} worth writing to`
        );
        await loadRows(scan.id, signature);
      }
      await loadRows(scan.id, signature);
    } catch {
      setError("The scan stopped early. Re-open it to carry on.");
    } finally {
      setBusy(false);
    }
  }

  const visible = showAll ? rows : rows.filter((r) => r.qualified);
  const current = scans.find((s) => s.id === openScan);

  return (
    <section className="mt-10 flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold">Prospecting</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Paste sites, one per line. Only the ones whose link preview is
          genuinely broken come back — with the card they could have and a
          drafted email.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5">
        <textarea
          value={sites}
          onChange={(e) => setSites(e.target.value)}
          rows={6}
          spellCheck={false}
          placeholder={"someapp.com\nanotherapp.com/pricing\n# comments and blank lines are ignored"}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs text-white outline-none placeholder:text-zinc-600 focus:border-indigo-500"
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Shopify apps, week 1"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-white outline-none focus:border-indigo-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            Bar
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as "strict" | "wide")}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-white outline-none focus:border-indigo-500"
            >
              <option value="strict">Strict — visibly broken only</option>
              <option value="wide">Wide — also badly degraded</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            Sign-off
            <input
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              // Re-drafted on blur, not per keystroke: each redraft is a
              // round trip, and nobody needs to watch it change letter by
              // letter.
              onBlur={() => {
                if (openScan) void loadRows(openScan, signature);
              }}
              placeholder="— Your Name"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-white outline-none focus:border-indigo-500"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={startScan}
            disabled={busy || sites.trim() === ""}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy ? "Reading sites…" : "Scan"}
          </button>
          {progress ? <span className="text-sm text-zinc-400">{progress}</span> : null}
          {error ? <span className="text-sm text-red-400">{error}</span> : null}
        </div>
      </div>

      {scans.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {scans.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => void selectScan(s.id)}
                className={`flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-left text-sm ${
                  openScan === s.id
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-600"
                }`}
              >
                <span className="min-w-0 flex-1 truncate text-zinc-200">{s.name}</span>
                <Chip tone={VERDICT_TONE.broken}>{s.qualified} to write to</Chip>
                <span className="text-xs text-zinc-500">
                  {s.done}/{s.total} · {s.status}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {current ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-semibold">
              {current.qualified} worth writing to
              <span className="ml-2 font-normal text-zinc-500">
                of {current.total} read
              </span>
            </h3>
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-950"
              />
              Show every site, not just the prospects
            </label>
            <a
              href={`/api/prospects/${current.id}/download`}
              className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs hover:border-zinc-500"
            >
              Download CSV
            </a>
          </div>

          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">
              {current.done < current.total
                ? "Still reading…"
                : showAll
                  ? "Nothing here."
                  : "No prospects in this batch — every site's card was fine, or only imperfect. Try the wide bar, or a different niche."}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {visible.map((r) =>
                r.qualified ? (
                  <Prospect key={r.idx} scanId={current.id} row={r} />
                ) : (
                  <li
                    key={r.idx}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-zinc-800 bg-zinc-900/30 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate text-zinc-400">
                      {r.domain ?? r.input}
                    </span>
                    {r.verdict ? (
                      <Chip tone={VERDICT_TONE[r.verdict] ?? "bg-zinc-700 text-zinc-300"}>
                        {r.verdict}
                      </Chip>
                    ) : null}
                    <span className="text-xs text-zinc-600">{r.reason}</span>
                  </li>
                )
              )}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
