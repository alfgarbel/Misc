import { describe, it, expect } from "vitest";
import { fitWithin, imageDimensions } from "@/lib/urlcard/dimensions";

/** Builds the header bytes each format actually states its size in. */
function png(w: number, h: number): Buffer {
  const b = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12, "ascii");
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return b;
}

function gif(w: number, h: number): Buffer {
  const b = Buffer.alloc(13);
  b.write("GIF89a", 0, "ascii");
  b.writeUInt16LE(w, 6);
  b.writeUInt16LE(h, 8);
  return b;
}

function jpeg(w: number, h: number, opts: { withApp0?: boolean } = {}): Buffer {
  const parts: Buffer[] = [Buffer.from([0xff, 0xd8])];
  if (opts.withApp0 !== false) {
    // A JFIF APP0 segment, which real files carry before the frame header.
    const app0 = Buffer.alloc(18);
    app0.writeUInt16BE(0xffe0, 0);
    app0.writeUInt16BE(16, 2);
    app0.write("JFIF\0", 4, "ascii");
    parts.push(app0);
  }
  const sof = Buffer.alloc(11);
  sof.writeUInt16BE(0xffc0, 0); // SOF0
  sof.writeUInt16BE(9, 2);
  sof.writeUInt8(8, 4);
  sof.writeUInt16BE(h, 5);
  sof.writeUInt16BE(w, 7);
  parts.push(sof);
  return Buffer.concat(parts);
}

describe("imageDimensions", () => {
  it("reads PNG dimensions", () => {
    expect(imageDimensions(png(1024, 1024))).toEqual({ width: 1024, height: 1024 });
    expect(imageDimensions(png(2800, 1600))).toEqual({ width: 2800, height: 1600 });
  });

  it("reads GIF dimensions", () => {
    expect(imageDimensions(gif(400, 300))).toEqual({ width: 400, height: 300 });
  });

  it("reads JPEG dimensions, walking past earlier segments", () => {
    expect(imageDimensions(jpeg(1200, 630))).toEqual({ width: 1200, height: 630 });
    expect(imageDimensions(jpeg(640, 480, { withApp0: false }))).toEqual({
      width: 640,
      height: 480,
    });
  });

  it("returns null rather than guessing for anything unreadable", () => {
    expect(imageDimensions(Buffer.alloc(0))).toBeNull();
    expect(imageDimensions(Buffer.from("not an image"))).toBeNull();
    expect(imageDimensions(png(0, 0))).toBeNull();
    // Truncated headers must not read past the end of the buffer.
    expect(imageDimensions(png(100, 100).subarray(0, 18))).toBeNull();
    expect(imageDimensions(Buffer.from([0xff, 0xd8, 0xff]))).toBeNull();
  });

  it("rejects absurd dimensions that mean we misread the header", () => {
    expect(imageDimensions(png(100000, 100))).toBeNull();
  });

  it("terminates on a malformed JPEG segment chain", () => {
    // A zero-length segment would otherwise loop forever.
    const b = Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      Buffer.from([0xff, 0xe0, 0x00, 0x00]),
      Buffer.alloc(20),
    ]);
    expect(imageDimensions(b)).toBeNull();
  });
});

describe("fitWithin", () => {
  const box = { width: 382, height: 510 };

  it("shrinks a wide banner to fit the width, keeping its shape", () => {
    const out = fitWithin({ width: 2800, height: 1600 }, box);
    expect(out.width).toBe(382);
    expect(out.height).toBe(218);
    // Aspect ratio preserved to within a rounded pixel.
    expect(Math.abs(out.width / out.height - 2800 / 1600)).toBeLessThan(0.02);
  });

  it("shrinks a square logo without distorting it", () => {
    const out = fitWithin({ width: 1024, height: 1024 }, box);
    expect(out.width).toBe(382);
    expect(out.height).toBe(382);
  });

  it("fits a tall image to the height, not the width", () => {
    const out = fitWithin({ width: 600, height: 1600 }, box);
    expect(out.height).toBe(510);
    expect(out.width).toBeLessThan(382);
  });

  it("never enlarges a small image past its own resolution", () => {
    // Upscaling a 64px favicon to fill the panel just renders it blurry.
    expect(fitWithin({ width: 64, height: 64 }, box)).toEqual({ width: 64, height: 64 });
    expect(fitWithin({ width: 200, height: 100 }, box)).toEqual({ width: 200, height: 100 });
  });

  it("always returns at least one pixel", () => {
    const out = fitWithin({ width: 10000, height: 1 }, box);
    expect(out.width).toBeGreaterThanOrEqual(1);
    expect(out.height).toBeGreaterThanOrEqual(1);
  });

  it("never returns something larger than the box", () => {
    for (const img of [
      { width: 4000, height: 30 },
      { width: 30, height: 4000 },
      { width: 3000, height: 3000 },
      { width: 1200, height: 630 },
    ]) {
      const out = fitWithin(img, box);
      expect(out.width, JSON.stringify(img)).toBeLessThanOrEqual(box.width);
      expect(out.height, JSON.stringify(img)).toBeLessThanOrEqual(box.height);
    }
  });
});
