"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  canvasOfSpec,
  MAX_LAYERS,
  specPlaceholders,
  templateSpecSchema,
  type Layer,
  type TemplateSpec,
} from "@/lib/og/spec";
import { SIZES, SIZE_IDS } from "@/lib/og/sizes";
import EditorCanvas from "./EditorCanvas";
import LayerInspector, { BackgroundInspector } from "./LayerInspector";
import AssetManager from "./AssetManager";
import type { EditorAsset } from "./types";

/** Sensible stand-ins so a new design isn't laid out against empty strings. */
const SAMPLE: Record<string, string> = {
  title: "Your headline goes here",
  subtitle: "A supporting line that explains the post",
  site: "example.com",
  author: "Ada Lovelace",
};

function newId(type: string): string {
  return `${type}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function TemplateEditor({
  templateId,
  initialName,
  initialSlug,
  initialSpec,
  initialAssets,
  assetLimit,
  baseUrl,
}: {
  templateId: string;
  initialName: string;
  initialSlug: string;
  initialSpec: TemplateSpec;
  initialAssets: EditorAsset[];
  assetLimit: number;
  baseUrl: string;
}) {
  const router = useRouter();
  const [spec, setSpec] = useState<TemplateSpec>(initialSpec);
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug);
  const [assets, setAssets] = useState(initialAssets);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSpec.layers[0]?.id ?? null
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [tab, setTab] = useState<"layers" | "assets">("layers");
  const [preview, setPreview] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(600);

  // The canvas is a scaled copy of a fixed 1200x630 design, so it has to be
  // measured rather than sized in CSS — every layer position depends on the
  // scale factor.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setCanvasWidth(Math.max(240, Math.floor(entry.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Custom fonts have to be loaded into the page too, or the canvas would
  // show a fallback while the rendered PNG shows the real face.
  const fontFaces = useMemo(
    () =>
      assets
        .filter((a) => a.kind === "font" && a.fontFamily)
        .map(
          (a) =>
            `@font-face{font-family:"${a.fontFamily}";src:url("/api/assets/${a.id}");font-weight:${a.fontWeight ?? 400};font-style:${a.fontStyle ?? "normal"};font-display:block;}`
        )
        .join("\n"),
    [assets]
  );

  const placeholders = useMemo(() => specPlaceholders(spec), [spec]);
  const values = useMemo(() => {
    const v: Record<string, string> = {};
    for (const key of placeholders) v[key] = SAMPLE[key] ?? key;
    return v;
  }, [placeholders]);

  const selected = spec.layers.find((l) => l.id === selectedId) ?? null;

  const updateLayer = useCallback((id: string, patch: Partial<Layer>) => {
    setSpec((prev) => ({
      ...prev,
      layers: prev.layers.map((l) =>
        l.id === id ? ({ ...l, ...patch } as Layer) : l
      ),
    }));
    setDirty(true);
  }, []);

  function addLayer(type: "text" | "image" | "box") {
    if (spec.layers.length >= MAX_LAYERS) {
      setStatus(`A template can hold ${MAX_LAYERS} layers.`);
      return;
    }
    const id = newId(type);
    const base = { id, x: 120, y: 120, opacity: 1, rotate: 0 };
    let layer: Layer;
    if (type === "text") {
      layer = {
        ...base,
        type: "text",
        text: "New text",
        w: 600,
        fontFamily: "Inter",
        fontAssetId: null,
        fontSize: 48,
        fontWeight: 700,
        color: "#ffffff",
        align: "left",
        lineHeight: 1.2,
        letterSpacing: 0,
        autoFit: true,
      };
    } else if (type === "box") {
      layer = { ...base, type: "box", w: 240, h: 12, color: "#6366f1", radius: 999 };
    } else {
      // Starts empty rather than grabbing whichever image happened to be
      // first: the picker below is where you choose, and choosing beats
      // guessing wrong and having to notice.
      const only = assets.filter((a) => a.kind === "image");
      layer = {
        ...base,
        type: "image",
        assetId: only.length === 1 ? only[0].id : "",
        w: 200,
        h: 200,
        fit: "contain",
        radius: 0,
      };
    }
    setSpec((prev) => ({ ...prev, layers: [...prev.layers, layer] }));
    setSelectedId(id);
    setDirty(true);
  }

  function moveLayer(id: string, dir: -1 | 1) {
    setSpec((prev) => {
      const i = prev.layers.findIndex((l) => l.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.layers.length) return prev;
      const layers = [...prev.layers];
      [layers[i], layers[j]] = [layers[j], layers[i]];
      return { ...prev, layers };
    });
    setDirty(true);
  }

  function deleteLayer(id: string) {
    setSpec((prev) => ({ ...prev, layers: prev.layers.filter((l) => l.id !== id) }));
    setSelectedId(null);
    setDirty(true);
  }

  async function refreshAssets() {
    const res = await fetch("/api/assets");
    if (!res.ok) return;
    const data = await res.json();
    setAssets(data.assets ?? []);
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const parsed = templateSpecSchema.safeParse(spec);
      if (!parsed.success) {
        setStatus(parsed.error.issues[0]?.message ?? "Design is not valid");
        return;
      }
      const res = await fetch(`/api/templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, spec: parsed.data }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data.error ?? "Could not save");
        return;
      }
      if (data.template?.slug && data.template.slug !== slug) {
        setSlug(data.template.slug);
      }
      setDirty(false);
      setStatus("Saved");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const renderPreview = useCallback(async () => {
    setPreviewing(true);
    setPreviewError(null);
    try {
      const res = await fetch(`/api/templates/${templateId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec, values }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPreviewError(data.error ?? "Preview failed");
        return;
      }
      const blob = await res.blob();
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
    } catch {
      setPreviewError("Preview failed");
    } finally {
      setPreviewing(false);
    }
  }, [templateId, spec, values]);

  // Nudge the selected layer with the arrow keys, the way design tools do.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!selectedId) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const step = e.shiftKey ? 10 : 1;
      const deltas: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const d = deltas[e.key];
      if (!d) return;
      e.preventDefault();
      const layer = spec.layers.find((l) => l.id === selectedId);
      if (!layer) return;
      updateLayer(selectedId, { x: layer.x + d[0], y: layer.y + d[1] } as Partial<Layer>);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, spec.layers, updateLayer]);

  const exampleUrl = `${baseUrl}/api/og?key=YOUR_KEY&tpl=${slug}${placeholders
    .map((p) => `&${p}=…`)
    .join("")}`;

  return (
    <>
      {fontFaces ? <style>{fontFaces}</style> : null}

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
            <span>?tpl=</span>
            <input
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setDirty(true);
              }}
              className="rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 font-mono text-xs text-emerald-400 outline-none focus:border-indigo-500"
            />
            <select
              value={spec.size}
              onChange={(e) => {
                // Layers hold absolute coordinates, so changing the canvas
                // moves nothing — it just reveals or crops space. The
                // warning below says so rather than silently rearranging.
                setSpec((prev) => ({
                  ...prev,
                  size: e.target.value as (typeof SIZE_IDS)[number],
                }));
                setDirty(true);
              }}
              className="rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-xs text-zinc-300 outline-none focus:border-indigo-500"
            >
              {SIZE_IDS.map((id) => (
                <option key={id} value={id}>
                  {SIZES[id].label} · {SIZES[id].width}×{SIZES[id].height}
                </option>
              ))}
            </select>
          </p>
          {spec.size !== initialSpec.size ? (
            <p className="mt-2 max-w-xl text-xs text-amber-300">
              Changing the canvas doesn&apos;t move your layers — they keep the
              coordinates you gave them, so check nothing has fallen outside
              the new shape before saving.
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {status ? (
            <span
              className={`text-sm ${status === "Saved" ? "text-emerald-400" : "text-red-400"}`}
            >
              {status}
            </span>
          ) : null}
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? "Saving…" : dirty ? "Save" : "Saved"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] [&>*]:min-w-0">
        <div className="space-y-4">
          <div ref={wrapRef}>
            <EditorCanvas
              spec={spec}
              assets={assets}
              values={values}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onChangeLayer={updateLayer}
              width={canvasWidth}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => addLayer("text")}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:border-zinc-500"
            >
              + Text
            </button>
            <button
              onClick={() => addLayer("image")}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:border-zinc-500"
            >
              + Image
            </button>
            <button
              onClick={() => addLayer("box")}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:border-zinc-500"
            >
              + Shape
            </button>
            <button
              onClick={renderPreview}
              disabled={previewing}
              className="ml-auto rounded-lg border border-indigo-500/50 bg-indigo-500/10 px-3 py-1.5 text-sm text-indigo-300 hover:border-indigo-400 disabled:opacity-50"
            >
              {previewing ? "Rendering…" : "Render preview"}
            </button>
          </div>

          <p className="text-xs text-zinc-500">
            Drag layers to move them, arrow keys to nudge (hold Shift for 10px,
            Alt while dragging for exact pixels).
          </p>

          {previewError ? (
            <p className="text-sm text-red-400">{previewError}</p>
          ) : null}
          {preview ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold">
                Rendered PNG{" "}
                <span className="font-normal text-zinc-500">
                  — what social platforms will actually receive
                </span>
              </h3>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Rendered preview"
                width={canvasOfSpec(spec).width}
                height={canvasOfSpec(spec).height}
                className="w-full rounded-lg border border-zinc-800"
              />
            </div>
          ) : null}

          <div>
            <h3 className="mb-2 text-sm font-semibold">Use this template</h3>
            <code className="block overflow-x-auto whitespace-nowrap rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-emerald-400">
              {exampleUrl}
            </code>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex gap-2 border-b border-zinc-800 pb-3">
            {(["layers", "assets"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
                  tab === t
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "assets" ? (
            <AssetManager
              assets={assets}
              limit={assetLimit}
              onChange={refreshAssets}
            />
          ) : (
            <>
              <BackgroundInspector
                background={spec.background}
                images={assets.filter((a) => a.kind === "image")}
                onChange={(background) => {
                  setSpec((prev) => ({ ...prev, background }));
                  setDirty(true);
                }}
                onAssetsChanged={refreshAssets}
              />

              <div className="border-t border-zinc-800 pt-3">
                <h3 className="mb-2 text-sm font-semibold">
                  Layers{" "}
                  <span className="font-normal text-zinc-500">
                    (last is on top)
                  </span>
                </h3>
                <ul className="space-y-1">
                  {spec.layers.map((l, i) => (
                    <li key={l.id} className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedId(l.id)}
                        className={`min-w-0 flex-1 truncate rounded px-2 py-1 text-left text-xs ${
                          l.id === selectedId
                            ? "bg-indigo-500/20 text-indigo-200"
                            : "text-zinc-400 hover:bg-zinc-800"
                        }`}
                      >
                        {l.type === "text"
                          ? l.text || "(empty)"
                          : l.type === "image" && !l.assetId
                            ? "image — none chosen"
                            : l.type}
                      </button>
                      <button
                        onClick={() => moveLayer(l.id, -1)}
                        disabled={i === 0}
                        className="px-1 text-xs text-zinc-600 hover:text-zinc-300 disabled:opacity-30"
                        aria-label="Move down"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => moveLayer(l.id, 1)}
                        disabled={i === spec.layers.length - 1}
                        className="px-1 text-xs text-zinc-600 hover:text-zinc-300 disabled:opacity-30"
                        aria-label="Move up"
                      >
                        ↑
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {selected ? (
                <div className="border-t border-zinc-800 pt-3">
                  <LayerInspector
                    layer={selected}
                    assets={assets}
                    onChange={(patch) => updateLayer(selected.id, patch)}
                    onDelete={() => deleteLayer(selected.id)}
                    onAssetsChanged={refreshAssets}
                  />
                </div>
              ) : (
                <p className="border-t border-zinc-800 pt-3 text-xs text-zinc-500">
                  Select a layer on the canvas to edit it.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
