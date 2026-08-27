"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TemplateSummary } from "./types";

export default function TemplateList({
  initial,
  limit,
  planName,
}: {
  initial: TemplateSummary[];
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
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled template" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not create a template");
        return;
      }
      router.push(`/dashboard/templates/${data.template.id}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? Cards using it will stop rendering.`)) {
      return;
    }
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((t) => t.id !== id));
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
          {busy ? "Creating…" : "New template"}
        </button>
      </div>
      {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center">
          <p className="text-sm text-zinc-400">
            No templates yet. Create one to design a card layer by layer, with
            your own fonts and images.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
          {items.map((t) => (
            <li
              key={t.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
            >
              <a
                href={`/dashboard/templates/${t.id}`}
                className="block truncate font-medium text-white hover:text-indigo-300"
              >
                {t.name}
              </a>
              <code className="mt-1 block truncate text-xs text-emerald-400">
                ?tpl={t.slug}
              </code>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-zinc-600">
                  {new Date(t.updatedAt).toLocaleDateString()}
                </span>
                <button
                  onClick={() => remove(t.id, t.name)}
                  className="text-xs text-zinc-500 hover:text-red-400"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
