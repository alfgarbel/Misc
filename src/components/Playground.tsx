"use client";

import { useMemo, useState } from "react";
import { TEMPLATES } from "@/lib/og/params";

const ACCENTS = ["#6366f1", "#f43f5e", "#10b981", "#f59e0b", "#06b6d4", "#a855f7"];

export default function Playground() {
  const [template, setTemplate] = useState<string>("gradient");
  const [title, setTitle] = useState("Ship social cards without a designer");
  const [subtitle, setSubtitle] = useState(
    "One GET request. A perfect 1200×630 image for every page."
  );
  const [site, setSite] = useState("yoursite.com");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [accent, setAccent] = useState(ACCENTS[0]);
  // Only update the image when the user clicks Render, to stay inside demo limits.
  const [rendered, setRendered] = useState<string | null>(null);

  const url = useMemo(() => {
    const p = new URLSearchParams({ template, title, theme, accent });
    if (subtitle) p.set("subtitle", subtitle);
    if (site) p.set("site", site);
    return `/api/og?${p.toString()}`;
  }, [template, title, subtitle, site, theme, accent]);

  const shownUrl = rendered ?? url;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-zinc-400">
          Template
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t}
                onClick={() => setTemplate(t)}
                className={`rounded-lg border px-3 py-1.5 capitalize ${
                  template === t
                    ? "border-indigo-500 bg-indigo-500/10 text-white"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-400">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none focus:border-indigo-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-400">
          Subtitle
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            maxLength={300}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none focus:border-indigo-500"
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm text-zinc-400">
            Site name
            <input
              value={site}
              onChange={(e) => setSite(e.target.value)}
              maxLength={100}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none focus:border-indigo-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-400">
            Theme
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as "dark" | "light")}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none focus:border-indigo-500"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>
        </div>
        <div className="flex flex-col gap-1 text-sm text-zinc-400">
          Accent
          <div className="flex gap-2">
            {ACCENTS.map((c) => (
              <button
                key={c}
                aria-label={`Accent ${c}`}
                onClick={() => setAccent(c)}
                className={`h-8 w-8 rounded-full border-2 ${
                  accent === c ? "border-white" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <button
          onClick={() => setRendered(url)}
          className="mt-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-500"
        >
          Render preview
        </button>
      </div>
      <div className="flex flex-col gap-3">
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shownUrl}
            alt="Generated Open Graph preview"
            width={1200}
            height={630}
            className="aspect-[1200/630] w-full object-cover"
          />
        </div>
        <code className="block overflow-x-auto whitespace-nowrap rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-xs text-emerald-400">
          GET {shownUrl}
        </code>
        <p className="text-xs text-zinc-500">
          Demo renders are watermarked and rate limited. Sign up for a free API
          key to remove limits per your plan.
        </p>
      </div>
    </div>
  );
}
