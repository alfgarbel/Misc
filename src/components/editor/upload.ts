import type { EditorAsset } from "./types";

export type UploadResult =
  | { ok: true; asset: EditorAsset }
  | { ok: false; error: string };

/**
 * One upload path for every place that accepts a file — the picker, the
 * asset list, the font control, and a file dropped on the card. They used
 * to each have their own copy, which is how the picker and the asset list
 * ended up reporting failures differently.
 */
export async function uploadAsset(file: File): Promise<UploadResult> {
  const body = new FormData();
  body.set("file", file);
  let res: Response;
  try {
    res = await fetch("/api/assets", { method: "POST", body });
  } catch {
    return { ok: false, error: "Upload failed — check your connection." };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.asset) {
    return { ok: false, error: data.error ?? "Upload failed" };
  }
  // Nothing can point at it yet: it did not exist a moment ago.
  return { ok: true, asset: { ...data.asset, usedBy: [] } as EditorAsset };
}

/**
 * The image's own pixel size, read in the browser before it is placed. A
 * dropped banner and a dropped square icon should not both land as the
 * same 200x200 box and have to be reshaped by hand.
 */
export async function imageSize(
  file: File
): Promise<{ w: number; h: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { w: bitmap.width, h: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}
