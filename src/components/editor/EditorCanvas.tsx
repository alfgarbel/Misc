"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  canvasOfSpec,
  fittedFontSize,
  resolvePlaceholders,
  type Layer,
  type TemplateSpec,
} from "@/lib/og/spec";
import type { EditorAsset } from "./types";

/** Movement snaps to this many design pixels; hold Alt for finer control. */
const SNAP = 4;

type DragState =
  | { mode: "move"; id: string; startX: number; startY: number; originX: number; originY: number }
  | { mode: "resize"; id: string; startX: number; startY: number; originW: number; originH: number };

function backgroundCss(spec: TemplateSpec): React.CSSProperties {
  const bg = spec.background;
  if (bg.type === "solid") return { backgroundColor: bg.color };
  if (bg.type === "gradient") {
    return {
      backgroundImage: `linear-gradient(${bg.angle}deg, ${bg.from} 0%, ${bg.to} 100%)`,
    };
  }
  return { backgroundColor: "#09090b" };
}

export default function EditorCanvas({
  spec,
  assets,
  values,
  selectedId,
  onSelect,
  onChangeLayer,
  onDropFiles,
  width,
}: {
  spec: TemplateSpec;
  assets: EditorAsset[];
  values: Record<string, string>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChangeLayer: (id: string, patch: Partial<Layer>) => void;
  /** Files dropped on the card, with the drop point in design pixels. */
  onDropFiles?: (files: File[], at: { x: number; y: number }) => void;
  width: number;
}) {
  const canvas = canvasOfSpec(spec);
  const scale = width / canvas.width;
  const drag = useRef<DragState | null>(null);
  const [, force] = useState(0);
  const [dropping, setDropping] = useState(false);

  const bg = spec.background;
  const bgAsset =
    bg.type === "image" ? assets.find((a) => a.id === bg.assetId) : undefined;

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const step = e.altKey ? 1 : SNAP;
      const dx = (e.clientX - d.startX) / scale;
      const dy = (e.clientY - d.startY) / scale;
      const round = (n: number) => Math.round(n / step) * step;
      if (d.mode === "move") {
        onChangeLayer(d.id, {
          x: round(d.originX + dx),
          y: round(d.originY + dy),
        } as Partial<Layer>);
      } else {
        onChangeLayer(d.id, {
          w: Math.max(8, round(d.originW + dx)),
          h: Math.max(8, round(d.originH + dy)),
        } as Partial<Layer>);
      }
      force((n) => n + 1);
    },
    [scale, onChangeLayer]
  );

  const onPointerUp = useCallback(() => {
    drag.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  return (
    <div
      className="relative select-none overflow-hidden rounded-lg border border-zinc-800"
      style={{
        width,
        height: width * (canvas.height / canvas.width),
        ...backgroundCss(spec),
      }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onSelect(null);
      }}
      // Dropping a file on the card is the shortest path from "I have a
      // logo" to "the logo is on the card": it uploads and places in one
      // gesture, with no tab to find first.
      onDragOver={(e) => {
        if (!onDropFiles || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDropping(true);
      }}
      onDragLeave={(e) => {
        // Moving onto a layer inside the card is not leaving the card.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setDropping(false);
      }}
      onDrop={(e) => {
        if (!onDropFiles) return;
        e.preventDefault();
        setDropping(false);
        const files = [...e.dataTransfer.files];
        if (files.length === 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        onDropFiles(files, {
          x: Math.round((e.clientX - rect.left) / scale),
          y: Math.round((e.clientY - rect.top) / scale),
        });
      }}
    >
      {bgAsset ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/assets/${bgAsset.id}`}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: bg.type === "image" ? bg.fit : "cover",
          }}
        />
      ) : null}

      {spec.layers.map((layer) => {
        const selected = layer.id === selectedId;
        const common: React.CSSProperties = {
          position: "absolute",
          left: layer.x * scale,
          top: layer.y * scale,
          opacity: layer.opacity,
          transform: layer.rotate ? `rotate(${layer.rotate}deg)` : undefined,
          cursor: "move",
          outline: selected ? "2px solid #6366f1" : undefined,
          outlineOffset: 1,
        };

        const startMove = (e: React.PointerEvent) => {
          e.stopPropagation();
          onSelect(layer.id);
          drag.current = {
            mode: "move",
            id: layer.id,
            startX: e.clientX,
            startY: e.clientY,
            originX: layer.x,
            originY: layer.y,
          };
        };

        let node: React.ReactNode = null;
        if (layer.type === "box") {
          node = (
            <div
              key={layer.id}
              onPointerDown={startMove}
              style={{
                ...common,
                width: layer.w * scale,
                height: layer.h * scale,
                backgroundColor: layer.color,
                borderRadius: layer.radius * scale,
              }}
            />
          );
        } else if (layer.type === "image") {
          const asset = assets.find((a) => a.id === layer.assetId);
          node = (
            <div
              key={layer.id}
              onPointerDown={startMove}
              style={{
                ...common,
                width: layer.w * scale,
                height: layer.h * scale,
                borderRadius: layer.radius * scale,
                overflow: "hidden",
                border: asset ? undefined : "1px dashed #52525b",
              }}
            >
              {asset ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/assets/${asset.id}`}
                  alt=""
                  draggable={false}
                  style={{ width: "100%", height: "100%", objectFit: layer.fit }}
                />
              ) : null}
            </div>
          );
        } else {
          const text = resolvePlaceholders(layer.text, values);
          const size = fittedFontSize(layer, text);
          node = (
            <div
              key={layer.id}
              onPointerDown={startMove}
              style={{
                ...common,
                width: layer.w * scale,
                fontFamily: `"${layer.fontFamily}", Inter, system-ui, sans-serif`,
                fontSize: size * scale,
                fontWeight: layer.fontWeight,
                color: layer.color,
                lineHeight: layer.lineHeight,
                letterSpacing: layer.letterSpacing * scale,
                textAlign: layer.align,
                // satori wraps but never clips, so neither does the canvas.
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {text || (
                <span style={{ opacity: 0.4 }}>{layer.text || "Empty text"}</span>
              )}
            </div>
          );
        }

        return (
          <div key={layer.id}>
            {node}
            {selected && layer.type !== "text" ? (
              <div
                onPointerDown={(e) => {
                  e.stopPropagation();
                  drag.current = {
                    mode: "resize",
                    id: layer.id,
                    startX: e.clientX,
                    startY: e.clientY,
                    originW: layer.w,
                    originH: layer.h,
                  };
                }}
                style={{
                  position: "absolute",
                  left: (layer.x + layer.w) * scale - 6,
                  top: (layer.y + layer.h) * scale - 6,
                  width: 12,
                  height: 12,
                  backgroundColor: "#6366f1",
                  borderRadius: 3,
                  cursor: "nwse-resize",
                }}
              />
            ) : null}
          </div>
        );
      })}

      {dropping ? (
        // pointer-events-none, or the overlay would swallow the drop it is
        // there to advertise.
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-indigo-400 bg-indigo-950/70 text-sm font-medium text-indigo-100">
          Drop to add it to the card
        </div>
      ) : null}
    </div>
  );
}
