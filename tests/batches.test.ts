import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import { writeFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createTestDb } from "./helpers";
import { provisionAccount } from "@/lib/accounts";
import { buildZip, safeEntryName } from "@/lib/batches/zip";
import { csvToRows, parseCsv } from "@/lib/batches/csv";
import {
  createBatch,
  deleteBatch,
  getOwnedBatch,
  listRows,
  zipOfBatch,
  RETENTION_MS,
} from "@/lib/batches";

describe("the zip writer", () => {
  it("produces an archive a real unzip implementation accepts", () => {
    // Written by hand rather than pulled in as a dependency, so it is
    // checked against something that did not write it.
    const zip = buildZip([
      { name: "one.png", data: Buffer.from("first payload") },
      { name: "two.png", data: Buffer.from("second, rather longer payload") },
      { name: "unicode-namé.png", data: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
    ]);
    const dir = mkdtempSync(join(tmpdir(), "zip-"));
    const path = join(dir, "t.zip");
    writeFileSync(path, zip);

    const listing = execFileSync("python3", [
      "-c",
      `import zipfile,json;z=zipfile.ZipFile("${path}");print(json.dumps({"names":z.namelist(),"bad":z.testzip(),"first":z.read(z.namelist()[0]).decode()}))`,
    ]).toString();
    const parsed = JSON.parse(listing);
    expect(parsed.names).toEqual(["one.png", "two.png", "unicode-namé.png"]);
    // testzip returns the first corrupt entry, or null when all CRCs match.
    expect(parsed.bad).toBeNull();
    expect(parsed.first).toBe("first payload");
  });

  it("writes an archive with no entries without corrupting it", () => {
    const zip = buildZip([]);
    expect(zip.length).toBe(22); // end-of-central-directory record only
  });

  it("keeps entry offsets right across many entries", () => {
    const zip = buildZip(
      Array.from({ length: 30 }, (_, i) => ({
        name: `card-${i}.png`,
        data: Buffer.alloc(100 + i, i),
      }))
    );
    const dir = mkdtempSync(join(tmpdir(), "zip-"));
    const path = join(dir, "many.zip");
    writeFileSync(path, zip);
    const out = execFileSync("python3", [
      "-c",
      `import zipfile;z=zipfile.ZipFile("${path}");print(len(z.namelist()), z.testzip(), len(z.read("card-29.png")))`,
    ]).toString().trim();
    expect(out).toBe("30 None 129");
  });
});

describe("safeEntryName", () => {
  it("strips anything that could escape the archive", () => {
    // Names come from a caller's key, so they are attacker-influenced.
    expect(safeEntryName("../../etc/passwd", "x")).not.toContain("..");
    expect(safeEntryName("../../etc/passwd", "x")).not.toContain("/");
    expect(safeEntryName("a/b\\c", "x")).toBe("a-b-c");
  });

  it("falls back when nothing usable is left", () => {
    expect(safeEntryName("", "card-1")).toBe("card-1");
    expect(safeEntryName("...", "card-1")).toBe("card-1");
    expect(safeEntryName("   ", "card-1")).toBe("card-1");
  });

  it("replaces separators rather than dropping them", () => {
    // "///" becomes "---": harmless as a filename, and the property that
    // matters is that no separator survives into the archive.
    expect(safeEntryName("///", "card-1")).toBe("---");
    for (const name of ["///", "a/b", "..\\..\\x", "/etc/passwd"]) {
      const out = safeEntryName(name, "card-1");
      expect(out, name).not.toContain("/");
      expect(out, name).not.toContain("\\");
      expect(out, name).not.toContain("..");
    }
  });

  it("removes reserved punctuation", () => {
    expect(safeEntryName('a<b>c:d"e|f?g*h', "x")).toBe("abcdefgh");
  });

  it("bounds the length", () => {
    expect(safeEntryName("x".repeat(500), "y").length).toBeLessThanOrEqual(100);
  });
});

describe("CSV input", () => {
  it("reads quoted fields containing commas, quotes and newlines", () => {
    const rows = parseCsv('a,b\n"has, comma","says ""hi"""\n"two\nlines",z');
    expect(rows).toEqual([
      ["a", "b"],
      ["has, comma", 'says "hi"'],
      ["two\nlines", "z"],
    ]);
  });

  it("maps a header onto render parameters, with key naming the row", () => {
    const result = csvToRows("key,title,template\npost-1,Hello,gradient\npost-2,World,minimal");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toEqual([
      { key: "post-1", params: { title: "Hello", template: "gradient" } },
      { key: "post-2", params: { title: "World", template: "minimal" } },
    ]);
  });

  it("works without a key column", () => {
    const result = csvToRows("title\nOnly a title");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows[0]).toEqual({ key: undefined, params: { title: "Only a title" } });
    }
  });

  it("skips empty cells rather than sending blank parameters", () => {
    const result = csvToRows("title,subtitle\nHas title,");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rows[0].params).toEqual({ title: "Has title" });
  });

  it("tolerates a byte-order mark and trailing newlines", () => {
    const result = csvToRows("﻿title\nHello\n\n");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows).toHaveLength(1);
      // The BOM must not end up glued to the first column name.
      expect(result.columns).toEqual(["title"]);
    }
  });

  it("explains what is wrong instead of producing nonsense", () => {
    expect(csvToRows("")).toMatchObject({ ok: false });
    expect(csvToRows("title")).toMatchObject({ ok: false });
    const dup = csvToRows("title,title\na,b");
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error).toMatch(/twice/);
  });
});

async function seed() {
  const db = await createTestDb();
  const owner = await provisionAccount(db, { email: "o@example.com", passwordHash: "h" });
  const other = await provisionAccount(db, { email: "x@example.com", passwordHash: "h" });
  return { db, ownerId: owner.userId, otherId: other.userId };
}

describe("batch records", () => {
  it("stores one row per card, pending", async () => {
    const { db, ownerId } = await seed();
    const batch = await createBatch(db, ownerId, {
      name: "Catalogue",
      rows: [
        { key: "a", params: { title: "One" } },
        { key: "b", params: { title: "Two" } },
      ],
    });
    expect(batch.total).toBe(2);
    const rows = await listRows(db, batch.id);
    expect(rows.map((r) => r.status)).toEqual(["pending", "pending"]);
    expect(rows.map((r) => r.key)).toEqual(["a", "b"]);
  });

  it("sets a retention window, so a batch is not a file host", async () => {
    const { db, ownerId } = await seed();
    const now = new Date("2026-08-27T00:00:00Z");
    const batch = await createBatch(db, ownerId, { rows: [{ params: { title: "x" } }] }, now);
    expect(batch.retainUntil?.getTime()).toBe(now.getTime() + RETENTION_MS);
  });

  it("will not read or delete another account's batch", async () => {
    const { db, ownerId, otherId } = await seed();
    const batch = await createBatch(db, ownerId, { rows: [{ params: { title: "x" } }] });
    expect(await getOwnedBatch(db, otherId, batch.id)).toBeNull();
    expect(await deleteBatch(db, otherId, batch.id)).toBe(false);
    expect(await getOwnedBatch(db, ownerId, batch.id)).not.toBeNull();
  });

  it("refuses a download for a batch that kept no images", async () => {
    const { db, ownerId } = await seed();
    const batch = await createBatch(db, ownerId, {
      storeImages: false,
      rows: [{ params: { title: "x" } }],
    });
    const result = await zipOfBatch(db, batch);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/without keeping images/);
  });

  it("refuses a download once the retention window has passed", async () => {
    const { db, ownerId } = await seed();
    const created = new Date("2026-08-27T00:00:00Z");
    const batch = await createBatch(db, ownerId, { rows: [{ params: { title: "x" } }] }, created);
    const later = new Date(created.getTime() + RETENTION_MS + 1000);
    const result = await zipOfBatch(db, batch, later);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/expired/);
  });
});
