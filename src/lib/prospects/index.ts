import { randomUUID } from "crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import type { Database } from "../db";
import { prospectScans, prospectRows } from "../db/schema";
import type { ProspectScanRow, ProspectItemRow } from "../db/schema";
import { checkUrl } from "../checker/report";
import { coerceUrl } from "../checker/url";
import { qualify, draftEmail, type QualifyTier } from "../checker/prospect";
import { robotsAllowsUrl } from "../checker/robots";

/**
 * Running a prospecting scan from the browser.
 *
 * The same judgement as the CLI script, worked a slice at a time inside
 * ordinary requests — there is no queue in this architecture, and reading
 * five hundred sites will not finish inside one function timeout. The
 * caller keeps posting to /run until it says finished, exactly as batches
 * do.
 *
 * Rows keep enough of each page to re-render its card and re-draft its
 * email without reading the site again. That is cheaper than storing a
 * PNG per prospect, and it means a card opened a week later still matches
 * the finding that was recorded.
 */

/** Sites read per call. Each one is a network round trip, so this is small. */
export const SLICE_SIZE = 5;

/** A scan is a working queue, not a database of the web. */
export const MAX_SITES = 500;

export interface ScanInput {
  name?: string;
  tier?: QualifyTier;
  /** Raw lines, exactly as pasted. */
  lines: string[];
}

/** Blank lines and # comments are dropped; the rest is kept verbatim. */
export function parseLines(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    // The same site twice in a pasted list is a slip, not an instruction.
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed.slice(0, 500));
    if (out.length >= MAX_SITES) break;
  }
  return out;
}

export async function createScan(
  db: Database,
  userId: string,
  input: ScanInput,
  now: Date = new Date()
): Promise<ProspectScanRow> {
  const scan: ProspectScanRow = {
    id: randomUUID(),
    userId,
    name: (input.name ?? "Scan").slice(0, 80) || "Scan",
    status: "pending",
    tier: input.tier === "wide" ? "wide" : "strict",
    total: input.lines.length,
    done: 0,
    qualified: 0,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
  await db.insert(prospectScans).values(scan);
  if (input.lines.length > 0) {
    await db.insert(prospectRows).values(
      input.lines.map((input, idx) => ({
        scanId: scan.id,
        idx,
        input,
        url: null,
        status: "pending",
        verdict: null,
        qualified: false,
        findingId: null,
        reason: null,
        claim: null,
        pageUrl: null,
        domain: null,
        title: null,
        description: null,
        siteName: null,
        findings: null,
        checkedAt: null,
      }))
    );
  }
  return scan;
}

export async function getOwnedScan(
  db: Database,
  userId: string,
  id: string
): Promise<ProspectScanRow | null> {
  const row = await db.query.prospectScans.findFirst({
    where: and(eq(prospectScans.id, id), eq(prospectScans.userId, userId)),
  });
  return row ?? null;
}

export async function listScans(
  db: Database,
  userId: string,
  limit = 20
): Promise<ProspectScanRow[]> {
  return db
    .select()
    .from(prospectScans)
    .where(eq(prospectScans.userId, userId))
    .orderBy(desc(prospectScans.createdAt))
    .limit(limit);
}

export async function scanRows(
  db: Database,
  scanId: string,
  opts: { qualifiedOnly?: boolean } = {}
): Promise<ProspectItemRow[]> {
  const where = opts.qualifiedOnly
    ? and(eq(prospectRows.scanId, scanId), eq(prospectRows.qualified, true))
    : eq(prospectRows.scanId, scanId);
  return db
    .select()
    .from(prospectRows)
    .where(where)
    .orderBy(asc(prospectRows.idx));
}

export async function deleteScan(
  db: Database,
  userId: string,
  id: string
): Promise<boolean> {
  const existing = await getOwnedScan(db, userId, id);
  if (!existing) return false;
  await db.delete(prospectScans).where(eq(prospectScans.id, id));
  return true;
}

export interface SliceResult {
  processed: number;
  done: number;
  total: number;
  qualified: number;
  finished: boolean;
}

/**
 * Reads the next few sites and records what was found.
 *
 * Never throws for a single bad site: one unreachable host must not stop a
 * scan of five hundred, so every failure is written to its own row and the
 * run continues.
 */
export async function processScanSlice(
  db: Database,
  scan: ProspectScanRow,
  limit = SLICE_SIZE,
  deps: {
    check?: typeof checkUrl;
    robotsAllows?: (url: string) => Promise<boolean>;
    now?: () => Date;
  } = {}
): Promise<SliceResult> {
  const check = deps.check ?? checkUrl;
  const allowed = deps.robotsAllows ?? robotsAllowsUrl;
  const now = deps.now ?? (() => new Date());

  const pending = await db
    .select()
    .from(prospectRows)
    .where(
      and(eq(prospectRows.scanId, scan.id), eq(prospectRows.status, "pending"))
    )
    .orderBy(asc(prospectRows.idx))
    .limit(limit);

  if (pending.length > 0 && scan.status === "pending") {
    await db
      .update(prospectScans)
      .set({ status: "running", updatedAt: now() })
      .where(eq(prospectScans.id, scan.id));
  }

  let newlyQualified = 0;

  for (const row of pending) {
    const patch: Partial<ProspectItemRow> = { checkedAt: now() };
    const target = coerceUrl(row.input);

    if (!target) {
      Object.assign(patch, {
        status: "skipped",
        reason: "Not a web address",
      });
    } else {
      patch.url = target;
      let permitted = true;
      try {
        permitted = await allowed(target);
      } catch {
        // robots.txt being unreadable is permission, not refusal.
        permitted = true;
      }

      if (!permitted) {
        Object.assign(patch, {
          status: "skipped",
          reason: "Disallowed by robots.txt",
        });
      } else {
        const report = await check(target);
        if (!report.ok) {
          Object.assign(patch, { status: "error", reason: report.message });
        } else {
          const q = qualify(report, scan.tier === "wide" ? "wide" : "strict");
          Object.assign(patch, {
            status: "checked",
            verdict: report.diagnosis.verdict,
            pageUrl: report.pageUrl,
            domain: report.meta.domain,
            title: report.meta.title,
            description: report.meta.description,
            siteName: report.meta.siteName,
            findings: report.diagnosis.findings.map((f) => f.id).join(" "),
            qualified: q.qualified,
            findingId: q.qualified ? q.finding.id : null,
            reason: q.qualified ? null : q.reason,
            claim: q.qualified ? q.claim : null,
          });
          if (q.qualified) newlyQualified++;
        }
      }
    }

    await db
      .update(prospectRows)
      .set(patch)
      .where(
        and(eq(prospectRows.scanId, scan.id), eq(prospectRows.idx, row.idx))
      );
  }

  const done = scan.done + pending.length;
  const qualified = scan.qualified + newlyQualified;
  const finished = done >= scan.total;
  await db
    .update(prospectScans)
    .set({
      done,
      qualified,
      status: finished ? "completed" : "running",
      updatedAt: now(),
      completedAt: finished ? now() : null,
    })
    .where(eq(prospectScans.id, scan.id));

  return {
    processed: pending.length,
    done,
    total: scan.total,
    qualified,
    finished,
  };
}

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function scanCsv(rows: ProspectItemRow[]): string {
  const head = [
    "input",
    "url",
    "status",
    "verdict",
    "qualified",
    "finding",
    "reason",
    "domain",
    "title",
    "all_findings",
  ];
  const body = rows.map((r) =>
    [
      r.input,
      r.pageUrl ?? r.url,
      r.status,
      r.verdict,
      r.qualified ? "yes" : "no",
      r.findingId,
      r.reason,
      r.domain,
      r.title,
      r.findings,
    ]
      .map(csvCell)
      .join(",")
  );
  return [head.join(","), ...body].join("\n");
}

/**
 * Rebuilds the email for a stored row.
 *
 * Takes the row rather than a live report so a draft can be produced long
 * after the scan, without reading the site again — the claim was recorded
 * at the time it was true.
 */
export function emailForRow(
  row: ProspectItemRow,
  opts: { signature: string; checkerBase: string }
): { subject: string; body: string } | null {
  if (!row.qualified || !row.claim || !row.pageUrl || !row.domain) return null;
  return draftEmail(
    { pageUrl: row.pageUrl, domain: row.domain },
    { claim: row.claim, findingId: row.findingId ?? "no-image" },
    {
      ...opts,
      attachmentName: `${row.domain.replace(/[^a-zA-Z0-9]+/g, "-")}.png`,
    }
  );
}
