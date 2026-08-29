"use client";

import { useRef, useState } from "react";
import type { EditorAsset } from "./types";
import { uploadAsset } from "./upload";

/**
 * Choosing an image by looking at it.
 *
 * The previous control was a dropdown of filenames, which asks you to
 * identify a picture by its name — and files arrive called logo.png,
 * IMG_0042.png or download.png, so two of them are routinely
 * indistinguishable. Two images both named logo.png made the picker
 * unusable outright: the options were identical, so the second upload
 * looked like it had replaced the first.
 */
export default function AssetPicker({
  images,
  selectedId,
  usedIds,
  onSelect,
  onUploaded,
  onRenamed,
  label = "Image",
  emptyHint = "Upload an image to place it on the card.",
}: {
  images: EditorAsset[];
  selectedId: string | null;
  /** Everything the design already uses, so a tile can say it's in play. */
  usedIds?: Set<string>;
  onSelect: (id: string) => void;
  onUploaded: () => void | Promise<void>;
  onRenamed?: () => void | Promise<void>;
  label?: string;
  emptyHint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = images.find((a) => a.id === selectedId) ?? null;

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const res = await uploadAsset(file);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      await onUploaded();
      // Uploading from here means you wanted to use it, so select it.
      onSelect(res.asset.id);
    } finally {
      setBusy(false);
    }
  }

  function startRename(a: EditorAsset) {
    onSelect(a.id);
    setRenaming(a.id);
    setDraftName(a.name);
  }

  async function commitRename(id: string) {
    const name = draftName.trim();
    setRenaming(null);
    if (!name) return;
    const res = await fetch(`/api/assets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) await onRenamed?.();
    else setError("Could not rename that file");
  }

  return (
    <div className="flex flex-col gap-2 text-xs text-zinc-400">
      <span>{label}</span>

      {images.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-800 p-3 text-zinc-500">
          {emptyHint}
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 [&>*]:min-w-0">
          {images.map((a) => {
            const isSelected = a.id === selectedId;
            return (
              <li key={a.id} className="relative min-w-0">
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelect(a.id)}
                  onDoubleClick={() => startRename(a)}
                  title={a.name}
                  className={`flex w-full cursor-pointer flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-zinc-800 bg-zinc-950 hover:border-zinc-600"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/assets/${a.id}`}
                    alt={a.name}
                    className="h-12 w-full rounded object-contain"
                  />
                  <span
                    className={`w-full min-w-0 truncate text-center text-[10px] ${
                      isSelected ? "text-indigo-200" : "text-zinc-500"
                    }`}
                  >
                    {a.name}
                  </span>
                </button>
                {/* Already somewhere on the card, just not in this slot —
                    worth knowing before you place the same logo twice. */}
                {!isSelected && usedIds?.has(a.id) ? (
                  <span
                    aria-hidden
                    title="Already used elsewhere on this card"
                    className="pointer-events-none absolute left-1 top-1 h-1.5 w-1.5 rounded-full bg-indigo-400"
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {/* Renaming happens in a full-width row, not on the tile itself: a tile
          is 65px across on a narrow phone, which is not a text field you can
          type a name into. */}
      {renaming ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void commitRename(renaming);
              if (e.key === "Escape") setRenaming(null);
            }}
            aria-label="New name"
            className="min-w-0 flex-1 rounded-lg border border-indigo-500 bg-zinc-950 px-2 py-1 text-xs text-white outline-none"
          />
          <button
            type="button"
            onClick={() => void commitRename(renaming)}
            className="rounded-lg border border-indigo-500 px-2.5 py-1 text-xs text-indigo-200 hover:bg-indigo-500/20"
          >
            {/* Not "Save": the editor's own Save sits in the header, and two
                buttons reading Save at once is a coin toss over whether you
                are saving a filename or the whole template. */}
            Save name
          </button>
          <button
            type="button"
            onClick={() => setRenaming(null)}
            className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs hover:border-zinc-500"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs hover:border-zinc-500 disabled:opacity-50"
          >
            {busy ? "Uploading…" : "Upload"}
          </button>
          {selected ? (
            <button
              type="button"
              onClick={() => startRename(selected)}
              className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs hover:border-zinc-500"
            >
              Rename
            </button>
          ) : null}
          {images.length > 0 ? (
            <span className="text-[11px] text-zinc-600">
              {selected
                ? `Using “${selected.name}”`
                : "Pick one to place it on the card"}
            </span>
          ) : null}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".png,.jpg,.jpeg,.gif,image/png,image/jpeg,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
