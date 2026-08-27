"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TEMPLATES } from "@/lib/og/params";
import type { Variant } from "@/lib/experiments/spec";
import type { Comparison, VariantTotals } from "@/lib/experiments/stats";

const field =
  "w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-white outline-none focus:border-indigo-500";

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export default function ExperimentEditor({
  id,
  initialName,
  initialSlug,
  initialStatus,
  initialVariants,
  totals,
  comparisons,
  baseUrl,
  apiKeyHint,
}: {
  id: string;
  initialName: string;
  initialSlug: string;
  initialStatus: string;
  initialVariants: Variant[];
  totals: VariantTotals[];
  comparisons: Comparison[];
  baseUrl: string;
  apiKeyHint: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug);
  const [status, setStatus] = useState(initialStatus);
  const [variants, setVariants] = useState<Variant[]>(initialVariants);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const started = totals.some((t) => t.keys > 0);
  const measured = totals.some((t) => t.exposures > 0 || t.conversions > 0);
  // Changing what a variant looks like is a different hazard from changing
  // its weight: the numbers already collected describe the old design.
  const designChanged =
    JSON.stringify(variants.map((v) => v.params)) !==
    JSON.stringify(initialVariants.map((v) => v.params));

  function patchVariant(index: number, patch: Partial<Variant>) {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, ...patch } : v))
    );
    setDirty(true);
  }

  function patchParam(index: number, key: string, value: string) {
    setVariants((prev) =>
      prev.map((v, i) =>
        i === index
          ? {
              ...v,
              params: { ...v.params, [key]: value || undefined },
            }
          : v
      )
    );
    setDirty(true);
  }

  async function reset() {
    if (
      !window.confirm(
        "Clear the numbers and start measuring again? Every page keeps the variant it already has, so nothing already shared changes appearance."
      )
    ) {
      return;
    }
    setResetting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/experiments/${id}/reset`, { method: "POST" });
      if (res.ok) router.refresh();
      else setMsg("Could not reset results");
    } finally {
      setResetting(false);
    }
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/experiments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, status, variants }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error ?? "Could not save");
        return;
      }
      if (data.experiment?.slug) setSlug(data.experiment.slug);
      setDirty(false);
      setMsg("Saved");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const snippet = `${baseUrl}/api/og?key=${apiKeyHint}&exp=${slug}&k=YOUR_PAGE_ID&title=…`;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
            className="w-full min-w-0 rounded-lg border border-transparent bg-transparent text-2xl font-bold text-white outline-none hover:border-zinc-800 focus:border-indigo-500 sm:w-auto"
          />
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
            <span>?exp=</span>
            <input
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setDirty(true);
              }}
              className="rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 font-mono text-xs text-emerald-400 outline-none focus:border-indigo-500"
            />
          </p>
        </div>
        <div className="flex items-center gap-3">
          {msg ? (
            <span
              className={`text-sm ${msg === "Saved" ? "text-emerald-400" : "text-red-400"}`}
            >
              {msg}
            </span>
          ) : null}
          <button
            onClick={() => {
              setStatus(status === "running" ? "stopped" : "running");
              setDirty(true);
            }}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:border-zinc-500"
          >
            {status === "running" ? "Stop" : "Resume"}
          </button>
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? "Saving…" : dirty ? "Save" : "Saved"}
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-6">
        <h2 className="mb-1 font-semibold">Results</h2>
        <p className="mb-4 text-sm text-zinc-400">
          Rates are outcomes per page, because a page is what gets randomised.
          Renders are crawler fetches, not the number of people who saw a card —
          nothing about a human&apos;s behaviour reaches OGsmith, so outcomes are
          whatever you report through the API.
        </p>
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="px-4 py-2.5">Variant</th>
                <th className="px-4 py-2.5">Pages</th>
                <th className="px-4 py-2.5">Renders</th>
                <th className="px-4 py-2.5">Outcomes</th>
                <th className="px-4 py-2.5">Rate</th>
              </tr>
            </thead>
            <tbody>
              {totals.map((t, i) => (
                <tr key={t.variantId} className="border-t border-zinc-800">
                  <td className="px-4 py-2.5">
                    <span className="text-zinc-200">{t.label}</span>
                    {i === 0 ? (
                      <span className="ml-2 text-xs text-zinc-600">baseline</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-400">{t.keys}</td>
                  <td className="px-4 py-2.5 text-zinc-400">{t.exposures}</td>
                  <td className="px-4 py-2.5 text-zinc-400">{t.conversions}</td>
                  <td className="px-4 py-2.5 text-zinc-300">
                    {t.keys > 0 ? pct(t.conversions / t.keys) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {measured ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={reset}
              disabled={resetting}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:border-zinc-500 disabled:opacity-50"
            >
              {resetting ? "Resetting…" : "Reset results"}
            </button>
            <span className="text-xs text-zinc-500">
              Clears the numbers, keeps every page on its current variant.
            </span>
          </div>
        ) : null}

        <div className="mt-4 space-y-2">
          {comparisons.map((c) => (
            <div
              key={c.challenger.variantId}
              className={`rounded-lg border p-3 text-sm ${
                c.significant
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-zinc-800 bg-zinc-950 text-zinc-400"
              }`}
            >
              <span className="text-zinc-300">{c.challenger.label}</span> vs{" "}
              <span className="text-zinc-300">{c.baseline.label}</span>:{" "}
              {c.note ? (
                <span>{c.note}</span>
              ) : (
                <span>
                  {c.lift !== null
                    ? `${c.lift >= 0 ? "+" : ""}${(c.lift * 100).toFixed(1)}%`
                    : "no baseline rate"}
                  {c.pValue !== null ? ` · p = ${c.pValue.toFixed(3)}` : ""}
                  {c.significant
                    ? " · unlikely to be chance"
                    : " · could still be chance"}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Variants */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-6">
        <h2 className="mb-1 font-semibold">Variants</h2>
        <p className="mb-4 text-sm text-zinc-400">
          Each variant sets parameters the render falls back on. Anything you
          pass explicitly in a URL still wins.
          {started ? (
            <>
              {" "}
              <span className="text-amber-300">
                Pages already assigned keep the variant they were given, so
                editing weights now only affects pages seen from here on.
              </span>
            </>
          ) : null}
        </p>

        {designChanged && measured ? (
          <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
            You&apos;ve changed what a variant looks like. The numbers above were
            collected under the old design, so once you save, one rate will be
            pooling two different cards. Reset the results after saving to start
            a clean measurement — assignments are kept, so nothing already
            shared changes.
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
          {variants.map((v, i) => (
            <div
              key={v.id}
              className="rounded-lg border border-zinc-800 bg-zinc-950 p-3"
            >
              <div className="mb-3 flex items-center gap-2">
                <code className="rounded bg-zinc-900 px-2 py-0.5 text-xs text-indigo-300">
                  {v.id}
                </code>
                <input
                  value={v.label}
                  onChange={(e) => patchVariant(i, { label: e.target.value })}
                  className={field}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 [&>*]:min-w-0">
                <label className="flex flex-col gap-1 text-xs text-zinc-500">
                  Template
                  <select
                    value={v.params.template ?? ""}
                    onChange={(e) => patchParam(i, "template", e.target.value)}
                    className={field}
                  >
                    <option value="">— unchanged —</option>
                    {TEMPLATES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-500">
                  Theme
                  <select
                    value={v.params.theme ?? ""}
                    onChange={(e) => patchParam(i, "theme", e.target.value)}
                    className={field}
                  >
                    <option value="">— unchanged —</option>
                    <option value="dark">dark</option>
                    <option value="light">light</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-500">
                  Accent
                  <input
                    value={v.params.accent ?? ""}
                    onChange={(e) => patchParam(i, "accent", e.target.value)}
                    placeholder="#6366f1"
                    className={field}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-500">
                  Weight
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={v.weight}
                    onChange={(e) =>
                      patchVariant(i, { weight: Math.max(1, Number(e.target.value) || 1) })
                    }
                    className={field}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="mb-2 text-sm font-semibold">Use this experiment</h3>
        <code className="block overflow-x-auto whitespace-nowrap rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-emerald-400">
          {snippet}
        </code>
        <p className="mt-3 text-sm text-zinc-500">
          <code className="text-zinc-400">k</code> identifies the page under
          test and must stay the same for that page forever — a post slug or id
          works well. With{" "}
          <code className="text-zinc-400">&amp;url=</code> it defaults to the
          URL. See the{" "}
          <a href="/docs#experiments" className="text-indigo-400 hover:underline">
            docs
          </a>{" "}
          for reporting outcomes.
        </p>
      </div>
    </>
  );
}
