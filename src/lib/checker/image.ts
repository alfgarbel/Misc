import { fetchImage, MAX_IMAGE_BYTES, FETCH_MESSAGES } from "../urlcard/fetch";
import { imageDimensions } from "../urlcard/dimensions";

/**
 * Looks at a page's og:image and reports what is wrong with it.
 *
 * `loadHeroImage` already fetches these, but it returns null for every kind
 * of failure — correct for rendering, where a missing image just degrades
 * the card, and useless here. "We couldn't use your image" is not a finding
 * anyone can act on; "your image is a 404" and "your image is an SVG" are
 * different problems with different fixes.
 */

export type ImageFault =
  | "unreachable"
  | "not_an_image"
  | "unsupported_format"
  | "too_large"
  | "unreadable_header";

export interface ImageFacts {
  ok: true;
  mimeType: string;
  bytes: number;
  /** Null when the header couldn't be parsed — rare, and not itself fatal. */
  width: number | null;
  height: number | null;
}

export interface ImageFault_ {
  ok: false;
  fault: ImageFault;
  detail: string;
}

export type ImageInspection = ImageFacts | ImageFault_;

function startsWith(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

/**
 * Formats named separately from the ones we render, because the question
 * here is "will social platforms show this", not "can we draw it".
 */
function formatOf(buf: Buffer): { mime: string; supported: boolean } | null {
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47])) {
    return { mime: "image/png", supported: true };
  }
  if (startsWith(buf, [0xff, 0xd8, 0xff])) {
    return { mime: "image/jpeg", supported: true };
  }
  if (startsWith(buf, [0x47, 0x49, 0x46, 0x38])) {
    return { mime: "image/gif", supported: true };
  }
  // "RIFF" then "WEBP" at offset 8.
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) {
    return { mime: "image/webp", supported: false };
  }
  const head = buf.toString("utf8", 0, 300).trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) {
    return { mime: "image/svg+xml", supported: false };
  }
  if (startsWith(buf, [0x00, 0x00, 0x01, 0x00])) {
    return { mime: "image/x-icon", supported: false };
  }
  if (head.startsWith("<!doctype html") || head.startsWith("<html")) {
    return { mime: "text/html", supported: false };
  }
  return null;
}

const UNSUPPORTED_DETAIL: Record<string, string> = {
  "image/webp":
    "It's a WebP. Support is uneven across social platforms — PNG or JPEG is the safe choice.",
  "image/svg+xml":
    "It's an SVG. No major platform renders SVG in a link preview. Export a PNG.",
  "image/x-icon":
    "It's a favicon (.ico), not a card image. Platforms won't use it.",
  "text/html":
    "That URL returns a web page, not an image — usually a 404 page served with a 200 status.",
};

export async function inspectImage(url: string): Promise<ImageInspection> {
  const res = await fetchImage(url);
  if (!res.ok) {
    if (res.reason === "too_large") {
      return {
        ok: false,
        fault: "too_large",
        detail: `The file is over ${MAX_IMAGE_BYTES / 1024 / 1024}MB. Large images are slow to unfurl and some platforms give up on them.`,
      };
    }
    if (res.reason === "wrong_type") {
      return {
        ok: false,
        fault: "not_an_image",
        detail: "That URL didn't return an image content type.",
      };
    }
    return { ok: false, fault: "unreachable", detail: FETCH_MESSAGES[res.reason] };
  }

  const format = formatOf(res.body);
  if (!format) {
    return {
      ok: false,
      fault: "not_an_image",
      detail: "The file isn't in any image format we recognise.",
    };
  }
  if (!format.supported) {
    return {
      ok: false,
      fault: format.mime === "text/html" ? "not_an_image" : "unsupported_format",
      detail: UNSUPPORTED_DETAIL[format.mime] ?? "That image format isn't widely supported.",
    };
  }

  const dims = imageDimensions(res.body);
  return {
    ok: true,
    mimeType: format.mime,
    bytes: res.body.length,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
  };
}
