"use client";

import { useRef, useState } from "react";
import type { EditorAsset } from "./types";

/**
 * Uploads are validated server-side from the file's own bytes; the accept
 * attribute here is only a convenience for the file picker.
 */
export default function AssetManager({
  assets,
  limit,
  onChange,
}: {
  assets: EditorAsset[];
  limit: number;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/assets", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Upload failed");
      else onChange();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error ?? "Could not delete");
    else onChange();
  }

  const atLimit = assets.length >= limit;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Images &amp; fonts</h3>
        <span className="text-xs text-zinc-500">
          {assets.length} / {limit}
        </span>
      </div>

      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy || atLimit}
        className="w-full rounded-lg border border-dashed border-zinc-700 px-3 py-3 text-sm text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50"
      >
        {busy ? "Uploading…" : atLimit ? "Upload limit reached" : "Upload a file"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.gif,.ttf,.otf,.woff,image/png,image/jpeg,image/gif,font/ttf,font/otf,font/woff"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
      <p className="mt-2 text-xs text-zinc-500">
        PNG, JPEG, GIF · TTF, OTF, WOFF. Up to 512KB.
      </p>
      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}

      <ul className="mt-4 space-y-2">
        {assets.map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-2"
          >
            {a.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/assets/${a.id}`}
                alt=""
                className="h-9 w-9 shrink-0 rounded border border-zinc-800 object-contain"
              />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-zinc-800 text-xs text-indigo-300">
                Aa
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-zinc-300">
                {a.kind === "font" ? a.fontFamily : a.name}
              </span>
              <span className="block text-xs text-zinc-600">
                {Math.round(a.byteSize / 1024)}KB
                {a.kind === "font" ? ` · ${a.fontWeight}` : ""}
              </span>
            </span>
            <button
              onClick={() => remove(a.id)}
              className="shrink-0 text-xs text-zinc-500 hover:text-red-400"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
