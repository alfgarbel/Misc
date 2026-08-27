/**
 * Reads an image's pixel dimensions from its header.
 *
 * The card layout needs to know the shape of a scraped image before it can
 * place it, and og:images vary far more than folklore suggests — a survey
 * of real pages turns up 2800x1600 banners next to 1024x1024 logos. Laying
 * both out the same way is what crops a logo in half.
 *
 * Only headers are parsed; nothing is decoded.
 */

export interface ImageDimensions {
  width: number;
  height: number;
}

function pngDimensions(buf: Buffer): ImageDimensions | null {
  // 8-byte signature, then a length + "IHDR" before width and height.
  if (buf.length < 24) return null;
  if (buf.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function gifDimensions(buf: Buffer): ImageDimensions | null {
  if (buf.length < 10) return null;
  return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
}

function jpegDimensions(buf: Buffer): ImageDimensions | null {
  // Walk the segment chain to the start-of-frame marker, which is the only
  // place a JPEG states its size.
  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buf[offset + 1];
    // Padding bytes between segments.
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    // SOF0-SOF15 carry the dimensions; C4/C8/CC are other things in range.
    const isFrameHeader =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isFrameHeader) {
      return {
        height: buf.readUInt16BE(offset + 5),
        width: buf.readUInt16BE(offset + 7),
      };
    }
    const length = buf.readUInt16BE(offset + 2);
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

export function imageDimensions(buf: Buffer): ImageDimensions | null {
  if (buf.length < 10) return null;
  let dims: ImageDimensions | null = null;
  if (buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG") {
    dims = pngDimensions(buf);
  } else if (buf.toString("ascii", 0, 3) === "GIF") {
    dims = gifDimensions(buf);
  } else if (buf[0] === 0xff && buf[1] === 0xd8) {
    dims = jpegDimensions(buf);
  }
  if (!dims) return null;
  // A zero or absurd dimension means the header lied or we misread it;
  // callers fall back to a layout that doesn't depend on knowing.
  if (
    !Number.isFinite(dims.width) ||
    !Number.isFinite(dims.height) ||
    dims.width < 1 ||
    dims.height < 1 ||
    dims.width > 40_000 ||
    dims.height > 40_000
  ) {
    return null;
  }
  return dims;
}

/**
 * Fits an image inside a box without cropping it and without enlarging it
 * past its own resolution — upscaling a small logo just renders it blurry.
 */
export function fitWithin(
  image: ImageDimensions,
  box: ImageDimensions
): ImageDimensions {
  const scale = Math.min(box.width / image.width, box.height / image.height, 1);
  return {
    width: Math.max(1, Math.round(image.width * scale)),
    height: Math.max(1, Math.round(image.height * scale)),
  };
}
