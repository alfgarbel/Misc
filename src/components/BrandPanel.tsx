"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TEMPLATES } from "@/lib/og/params";

export interface BrandValues {
  template: string;
  theme: string;
  accent: string;
  site: string;
}

export default function BrandPanel({ initial }: { initial: BrandValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof BrandValues>(k: K, v: string) {
    setValues((prev) => ({ ...prev, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      setStatus(res.ok ? "Saved" : data.error ?? "Could not save");
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const selectClass =
    "rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h2 className="mb-1 font-semibold">Brand defaults</h2>
      <p className="mb-4 text-sm text-zinc-400">
        Saved defaults apply to authenticated renders whenever a parameter is
        omitted — so your URLs can be as short as{" "}
        <code className="rounded bg-zinc-950 px-1.5 py-0.5 text-emerald-400">
          ?key=…&amp;title=Hello
        </code>
        . Explicit parameters always win.
      </p>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-zinc-400">
          Default template
          <select
            value={values.template}
            onChange={(e) => set("template", e.target.value)}
            className={selectClass}
          >
            <option value="">— none —</option>
            {TEMPLATES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-400">
          Default theme
          <select
            value={values.theme}
            onChange={(e) => set("theme", e.target.value)}
            className={selectClass}
          >
            <option value="">— none —</option>
            <option value="dark">dark</option>
            <option value="light">light</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-400">
          Default accent
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(values.accent) ? values.accent : "#6366f1"}
              onChange={(e) => set("accent", e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-zinc-700 bg-zinc-900"
            />
            <input
              value={values.accent}
              onChange={(e) => set("accent", e.target.value)}
              placeholder="#6366f1 (empty = none)"
              className={`flex-1 ${selectClass}`}
            />
          </div>
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-400">
          Default site name
          <input
            value={values.site}
            onChange={(e) => set("site", e.target.value)}
            maxLength={100}
            placeholder="yoursite.com (empty = none)"
            className={selectClass}
          />
        </label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save defaults"}
          </button>
          {status ? (
            <span
              className={`text-sm ${status === "Saved" ? "text-emerald-400" : "text-red-400"}`}
            >
              {status}
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
