import { describe, it, expect } from "vitest";
import { createTestDb } from "./helpers";
import { provisionAccount } from "@/lib/accounts";
import {
  createScan,
  getOwnedScan,
  listScans,
  parseLines,
  processScanSlice,
  scanCsv,
  scanRows,
  deleteScan,
  emailForRow,
  MAX_SITES,
} from "@/lib/prospects";
import type { CardReportResult } from "@/lib/checker/report";

async function seed() {
  const db = await createTestDb();
  const owner = await provisionAccount(db, { email: "o@example.com", passwordHash: "h" });
  const other = await provisionAccount(db, { email: "x@example.com", passwordHash: "h" });
  return { db, ownerId: owner.userId, otherId: other.userId };
}

/** A report for a page with no og:image — the canonical prospect. */
function brokenReport(url: string): CardReportResult {
  const domain = new URL(url).hostname.replace(/^www\./, "");
  return {
    ok: true,
    pageUrl: url,
    meta: {
      title: `${domain} — a page`,
      description: "Some description.",
      siteName: domain,
      imageUrl: null,
      domain,
      url,
    },
    tags: {
      ogTitle: null, ogDescription: null, ogImage: null, ogImageSecureUrl: null,
      ogImageWidth: null, ogImageHeight: null, ogImageAlt: null, ogSiteName: null,
      ogUrl: null, ogType: null, twitterCard: null, twitterImage: null,
      twitterTitle: null, twitterDescription: null, htmlTitle: `${domain} — a page`,
      metaDescription: null,
    },
    image: null,
    diagnosis: {
      findings: [
        { id: "no-image", severity: "error", title: "No preview image", detail: "…" },
      ],
      passed: [],
      verdict: "broken",
    },
    cached: false,
  };
}

const allow = async () => true;

describe("parsing a pasted list", () => {
  it("drops blanks and comments, keeps the rest verbatim", () => {
    expect(parseLines("a.com\n\n# note\n  b.com/x  \n")).toEqual(["a.com", "b.com/x"]);
  });

  it("drops a repeated site — the same line twice is a slip", () => {
    expect(parseLines("a.com\nA.COM\nb.com")).toEqual(["a.com", "b.com"]);
  });

  it("stops at the cap rather than accepting an unbounded paste", () => {
    const many = Array.from({ length: MAX_SITES + 50 }, (_, i) => `s${i}.com`).join("\n");
    expect(parseLines(many)).toHaveLength(MAX_SITES);
  });
});

describe("running a scan", () => {
  it("works through the list a slice at a time", async () => {
    const { db, ownerId } = await seed();
    const scan = await createScan(db, ownerId, {
      lines: ["a.com", "b.com", "c.com"],
    });

    let current = scan;
    const first = await processScanSlice(db, current, 2, {
      check: async (u) => brokenReport(u),
      robotsAllows: allow,
    });
    expect(first).toMatchObject({ processed: 2, done: 2, finished: false });

    current = (await getOwnedScan(db, ownerId, scan.id))!;
    const second = await processScanSlice(db, current, 2, {
      check: async (u) => brokenReport(u),
      robotsAllows: allow,
    });
    expect(second).toMatchObject({ processed: 1, done: 3, finished: true });
    expect(second.qualified).toBe(3);

    const after = await getOwnedScan(db, ownerId, scan.id);
    expect(after?.status).toBe("completed");
    expect(after?.completedAt).not.toBeNull();
  });

  it("records a site it could not read without stopping the run", async () => {
    const { db, ownerId } = await seed();
    const scan = await createScan(db, ownerId, { lines: ["dead.com", "b.com"] });
    await processScanSlice(db, scan, 10, {
      check: async (u) =>
        u.includes("dead.com")
          ? { ok: false, message: "That hostname couldn't be resolved." }
          : brokenReport(u),
      robotsAllows: allow,
    });
    const rows = await scanRows(db, scan.id);
    expect(rows[0].status).toBe("error");
    expect(rows[0].reason).toMatch(/couldn't be resolved/);
    expect(rows[1].status).toBe("checked");
    expect(rows[1].qualified).toBe(true);
  });

  it("skips a line that isn't a URL, and never fetches it", async () => {
    const { db, ownerId } = await seed();
    const scan = await createScan(db, ownerId, { lines: ["not a url"] });
    let fetched = false;
    await processScanSlice(db, scan, 10, {
      check: async (u) => {
        fetched = true;
        return brokenReport(u);
      },
      robotsAllows: allow,
    });
    expect(fetched).toBe(false);
    const [row] = await scanRows(db, scan.id);
    expect(row.status).toBe("skipped");
    expect(row.reason).toBe("Not a web address");
  });

  it("skips a site robots.txt disallows, and never reads the page", async () => {
    const { db, ownerId } = await seed();
    const scan = await createScan(db, ownerId, { lines: ["private.com"] });
    let fetched = false;
    await processScanSlice(db, scan, 10, {
      check: async (u) => {
        fetched = true;
        return brokenReport(u);
      },
      robotsAllows: async () => false,
    });
    expect(fetched).toBe(false);
    const [row] = await scanRows(db, scan.id);
    expect(row.status).toBe("skipped");
    expect(row.reason).toMatch(/robots\.txt/);
  });

  it("treats an unreadable robots.txt as permission, not refusal", async () => {
    const { db, ownerId } = await seed();
    const scan = await createScan(db, ownerId, { lines: ["a.com"] });
    await processScanSlice(db, scan, 10, {
      check: async (u) => brokenReport(u),
      robotsAllows: async () => {
        throw new Error("robots.txt exploded");
      },
    });
    const [row] = await scanRows(db, scan.id);
    expect(row.status).toBe("checked");
  });

  it("stores enough to rebuild the card and the email later", async () => {
    const { db, ownerId } = await seed();
    const scan = await createScan(db, ownerId, { lines: ["a.com"] });
    await processScanSlice(db, scan, 10, {
      check: async (u) => brokenReport(u),
      robotsAllows: allow,
    });
    const [row] = await scanRows(db, scan.id);
    expect(row.title).toBe("a.com — a page");
    expect(row.description).toBe("Some description.");
    expect(row.claim).toMatch(/shows no preview image/);

    const email = emailForRow(row, {
      signature: "— Alf",
      checkerBase: "https://ogsmith.app",
    });
    expect(email?.subject).toContain("a.com");
    expect(email?.body).toContain("https://a.com/");
    expect(email?.body.endsWith("— Alf")).toBe(true);
  });

  it("gives no email for a row that didn't qualify", async () => {
    const { db, ownerId } = await seed();
    const scan = await createScan(db, ownerId, { lines: ["not a url"] });
    await processScanSlice(db, scan, 10, { robotsAllows: allow });
    const [row] = await scanRows(db, scan.id);
    expect(emailForRow(row, { signature: "x", checkerBase: "y" })).toBeNull();
  });

  it("can return only the prospects", async () => {
    const { db, ownerId } = await seed();
    const scan = await createScan(db, ownerId, { lines: ["a.com", "not a url"] });
    await processScanSlice(db, scan, 10, {
      check: async (u) => brokenReport(u),
      robotsAllows: allow,
    });
    const only = await scanRows(db, scan.id, { qualifiedOnly: true });
    expect(only).toHaveLength(1);
    expect(only[0].domain).toBe("a.com");
  });
});

describe("ownership", () => {
  it("never hands one account's scan to another", async () => {
    const { db, ownerId, otherId } = await seed();
    const scan = await createScan(db, ownerId, { lines: ["a.com"] });
    expect(await getOwnedScan(db, otherId, scan.id)).toBeNull();
    expect(await deleteScan(db, otherId, scan.id)).toBe(false);
    expect(await listScans(db, otherId)).toHaveLength(0);
    // Still there for its owner.
    expect(await getOwnedScan(db, ownerId, scan.id)).not.toBeNull();
  });

  it("takes the rows with the scan when it is deleted", async () => {
    const { db, ownerId } = await seed();
    const scan = await createScan(db, ownerId, { lines: ["a.com", "b.com"] });
    expect(await deleteScan(db, ownerId, scan.id)).toBe(true);
    expect(await scanRows(db, scan.id)).toHaveLength(0);
  });
});

describe("the CSV", () => {
  it("has a row per site and quotes anything containing a comma", async () => {
    const { db, ownerId } = await seed();
    const scan = await createScan(db, ownerId, { lines: ["a.com", "not a url"] });
    await processScanSlice(db, scan, 10, {
      check: async (u) => ({
        ...(brokenReport(u) as Extract<CardReportResult, { ok: true }>),
        meta: {
          ...(brokenReport(u) as Extract<CardReportResult, { ok: true }>).meta,
          title: "Hello, world",
        },
      }),
      robotsAllows: allow,
    });
    const csv = scanCsv(await scanRows(db, scan.id));
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("qualified");
    expect(csv).toContain('"Hello, world"');
  });
});
