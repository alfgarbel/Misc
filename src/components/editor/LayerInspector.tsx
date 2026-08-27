"use client";

import type { Background, Layer, TemplateSpec } from "@/lib/og/spec";
import type { EditorAsset } from "./types";

const field =
  "w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-white outline-none focus:border-indigo-500";
const label = "flex flex-col gap-1 text-xs text-zinc-400";

function NumberField({
  name,
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  name: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <label className={label}>
      {name}
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className={field}
      />
    </label>
  );
}

function ColorField({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#ffffff";
  return (
    <label className={label}>
      {name}
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 shrink-0 cursor-pointer rounded border border-zinc-700 bg-zinc-900"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={field}
        />
      </span>
    </label>
  );
}

export function BackgroundInspector({
  background,
  images,
  onChange,
}: {
  background: Background;
  images: EditorAsset[];
  onChange: (bg: Background) => void;
}) {
  return (
    <div className="space-y-3">
      <label className={label}>
        Background
        <select
          value={background.type}
          onChange={(e) => {
            const type = e.target.value;
            if (type === "solid") onChange({ type: "solid", color: "#0b1020" });
            else if (type === "gradient")
              onChange({ type: "gradient", from: "#0b1020", to: "#4c1d95", angle: 135 });
            else
              onChange({
                type: "image",
                assetId: images[0]?.id ?? "",
                fit: "cover",
              });
          }}
          className={field}
        >
          <option value="solid">Solid colour</option>
          <option value="gradient">Gradient</option>
          <option value="image" disabled={images.length === 0}>
            Image{images.length === 0 ? " (upload one first)" : ""}
          </option>
        </select>
      </label>

      {background.type === "solid" ? (
        <ColorField
          name="Colour"
          value={background.color}
          onChange={(color) => onChange({ ...background, color })}
        />
      ) : null}

      {background.type === "gradient" ? (
        <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
          <ColorField
            name="From"
            value={background.from}
            onChange={(from) => onChange({ ...background, from })}
          />
          <ColorField
            name="To"
            value={background.to}
            onChange={(to) => onChange({ ...background, to })}
          />
          <NumberField
            name="Angle"
            value={background.angle}
            min={0}
            max={360}
            onChange={(angle) => onChange({ ...background, angle })}
          />
        </div>
      ) : null}

      {background.type === "image" ? (
        <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
          <label className={label}>
            Image
            <select
              value={background.assetId}
              onChange={(e) => onChange({ ...background, assetId: e.target.value })}
              className={field}
            >
              {images.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Fit
            <select
              value={background.fit}
              onChange={(e) =>
                onChange({
                  ...background,
                  fit: e.target.value as "cover" | "contain" | "fill",
                })
              }
              className={field}
            >
              <option value="cover">cover</option>
              <option value="contain">contain</option>
              <option value="fill">fill</option>
            </select>
          </label>
        </div>
      ) : null}
    </div>
  );
}

export default function LayerInspector({
  layer,
  assets,
  onChange,
  onDelete,
}: {
  layer: Layer;
  assets: EditorAsset[];
  onChange: (patch: Partial<Layer>) => void;
  onDelete: () => void;
}) {
  const fonts = assets.filter((a) => a.kind === "font");
  const images = assets.filter((a) => a.kind === "image");
  const patch = onChange as (p: Record<string, unknown>) => void;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold capitalize">{layer.type} layer</h3>
        <button
          onClick={onDelete}
          className="text-xs text-zinc-500 hover:text-red-400"
        >
          Delete layer
        </button>
      </div>

      {layer.type === "text" ? (
        <>
          <label className={label}>
            Text
            <textarea
              value={layer.text}
              rows={2}
              onChange={(e) => patch({ text: e.target.value })}
              className={`${field} resize-y`}
            />
          </label>
          <p className="text-xs text-zinc-500">
            Use <code className="text-emerald-400">{"{{title}}"}</code> for values
            you pass in the URL. Any name works.
          </p>
          <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
            <label className={label}>
              Font
              <select
                value={layer.fontAssetId ?? ""}
                onChange={(e) => {
                  const id = e.target.value;
                  const asset = fonts.find((f) => f.id === id);
                  patch({
                    fontAssetId: id || null,
                    fontFamily: asset?.fontFamily ?? "Inter",
                    ...(asset?.fontWeight ? { fontWeight: asset.fontWeight } : {}),
                  });
                }}
                className={field}
              >
                <option value="">Inter (built in)</option>
                {fonts.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.fontFamily} {f.fontWeight}
                  </option>
                ))}
              </select>
            </label>
            <NumberField
              name="Size"
              value={layer.fontSize}
              min={8}
              max={300}
              onChange={(fontSize) => patch({ fontSize })}
            />
            <NumberField
              name="Weight"
              value={layer.fontWeight}
              step={100}
              min={100}
              max={900}
              onChange={(fontWeight) => patch({ fontWeight })}
            />
            <NumberField
              name="Line height"
              value={layer.lineHeight}
              step={0.05}
              min={0.6}
              max={3}
              onChange={(lineHeight) => patch({ lineHeight })}
            />
            <NumberField
              name="Letter spacing"
              value={layer.letterSpacing}
              step={0.5}
              onChange={(letterSpacing) => patch({ letterSpacing })}
            />
            <label className={label}>
              Align
              <select
                value={layer.align}
                onChange={(e) => patch({ align: e.target.value })}
                className={field}
              >
                <option value="left">left</option>
                <option value="center">center</option>
                <option value="right">right</option>
              </select>
            </label>
            <ColorField
              name="Colour"
              value={layer.color}
              onChange={(color) => patch({ color })}
            />
            <NumberField
              name="Width"
              value={layer.w}
              min={8}
              onChange={(w) => patch({ w })}
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={layer.autoFit}
              onChange={(e) => patch({ autoFit: e.target.checked })}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-950"
            />
            Shrink long text to fit
          </label>
        </>
      ) : null}

      {layer.type === "image" ? (
        <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
          <label className={label}>
            Image
            <select
              value={layer.assetId}
              onChange={(e) => patch({ assetId: e.target.value })}
              className={field}
            >
              {images.length === 0 ? <option value="">No images yet</option> : null}
              {images.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Fit
            <select
              value={layer.fit}
              onChange={(e) => patch({ fit: e.target.value })}
              className={field}
            >
              <option value="contain">contain</option>
              <option value="cover">cover</option>
              <option value="fill">fill</option>
            </select>
          </label>
          <NumberField name="Width" value={layer.w} min={1} onChange={(w) => patch({ w })} />
          <NumberField name="Height" value={layer.h} min={1} onChange={(h) => patch({ h })} />
          <NumberField
            name="Corner radius"
            value={layer.radius}
            min={0}
            onChange={(radius) => patch({ radius })}
          />
        </div>
      ) : null}

      {layer.type === "box" ? (
        <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
          <ColorField
            name="Colour"
            value={layer.color}
            onChange={(color) => patch({ color })}
          />
          <NumberField
            name="Corner radius"
            value={layer.radius}
            min={0}
            onChange={(radius) => patch({ radius })}
          />
          <NumberField name="Width" value={layer.w} min={1} onChange={(w) => patch({ w })} />
          <NumberField name="Height" value={layer.h} min={1} onChange={(h) => patch({ h })} />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 border-t border-zinc-800 pt-3 [&>*]:min-w-0">
        <NumberField name="X" value={layer.x} onChange={(x) => patch({ x })} />
        <NumberField name="Y" value={layer.y} onChange={(y) => patch({ y })} />
        <NumberField
          name="Opacity"
          value={layer.opacity}
          step={0.05}
          min={0}
          max={1}
          onChange={(opacity) => patch({ opacity })}
        />
        <NumberField
          name="Rotation"
          value={layer.rotate}
          min={-180}
          max={180}
          onChange={(rotate) => patch({ rotate })}
        />
      </div>
    </div>
  );
}

export type { TemplateSpec };
