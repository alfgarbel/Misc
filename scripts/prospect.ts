/**
 * Turns a list of domains into a review queue of people worth writing to.
 *
 *   npm run prospect -- --input domains.txt --out ./outbound --signature "— Alf"
 *
 * For each URL it reads the page, judges the card, and — only when the card
 * is genuinely broken — renders what it could look like from that page's own
 * title and description, and drafts the email to go with it.
 *
 * Nothing is sent. The output is a folder you read through and decide on,
 * because the whole premise of the approach is that every claim is true, and
 * that survives exactly as long as a human is still looking.
 *
 * It runs against the library directly: no server, no API key, no render
 * quota consumed.
 */
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { checkUrl } from "../src/lib/checker/report";
import { coerceUrl } from "../src/lib/checker/url";
import { qualify, draftEmail, type QualifyTier } from "../src/lib/checker/prospect";
import { robotsAllowsUrl } from "../src/lib/checker/robots";
import { parseOgParams } from "../src/lib/og/params";
import { renderOgImage } from "../src/lib/og/render";

interface Options {
  input: string;
  out: string;
  tier: QualifyTier;
  delayMs: number;
  signature: string;
  base: string;
  ignoreRobots: boolean;
  limit: number;
  watermark: boolean;
}

function parseArgs(argv: string[]): Options {
  // Values are joined until the next --flag, so an unquoted multi-word
  // value still arrives whole. npm warns about a leading em-dash and users
  // drop the quotes to silence it, which would otherwise sign every email
  // with a lone "—".
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    if (i === -1) return undefined;
    const parts: string[] = [];
    for (let j = i + 1; j < argv.length && !argv[j].startsWith("--"); j++) {
      parts.push(argv[j]);
    }
    return parts.length > 0 ? parts.join(" ") : undefined;
  };
  const has = (name: string) => argv.includes(`--${name}`);

  const input = get("input");
  if (!input) {
    console.error(
      "Usage: npm run prospect -- --input <file> [--out ./outbound]\n" +
        "         [--tier strict|wide] [--delay 1500] [--signature '— Your Name']\n" +
        "         [--base https://ogsmith.app] [--limit 500] [--ignore-robots] [--watermark]\n\n" +
        "The input file holds one URL or domain per line. Blank lines and\n" +
        "lines starting with # are ignored."
    );
    process.exit(1);
  }
  const tier = get("tier") === "wide" ? "wide" : "strict";
  return {
    input,
    out: get("out") ?? "./outbound",
    tier,
    delayMs: Number(get("delay") ?? 1500),
    // Left obviously unfinished on purpose: an unsigned cold email should
    // look wrong before it is sent, not after.
    signature: get("signature") ?? "— [your name]",
    base: get("base") ?? "https://ogsmith.app",
    ignoreRobots: has("ignore-robots"),
    limit: Number(get("limit") ?? 500),
    watermark: has("watermark"),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Safe for a filename and stable, so re-runs overwrite rather than pile up. */
function slugOf(domain: string): string {
  return domain.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "site";
}

function csvCell(value: string | number | boolean): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const raw = await readFile(opts.input, "utf8");
  const urls = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .slice(0, opts.limit);

  const qualifiedDir = join(opts.out, "qualified");
  await mkdir(qualifiedDir, { recursive: true });

  const rows: string[][] = [
    ["input", "final_url", "verdict", "qualified", "reason_or_finding", "all_findings"],
  ];
  let qualifiedCount = 0;
  let skipped = 0;

  for (const [i, line] of urls.entries()) {
    const target = coerceUrl(line);
    const label = `[${i + 1}/${urls.length}] ${line}`;

    if (!target) {
      console.log(`${label} — not a URL, skipped`);
      rows.push([line, "", "", "no", "not a URL", ""]);
      continue;
    }

    if (!opts.ignoreRobots && !(await robotsAllowsUrl(target))) {
      console.log(`${label} — robots.txt says no, skipped`);
      rows.push([line, target, "", "no", "disallowed by robots.txt", ""]);
      skipped++;
      await sleep(opts.delayMs);
      continue;
    }

    const report = await checkUrl(target);
    if (!report.ok) {
      console.log(`${label} — couldn't read: ${report.message}`);
      rows.push([line, target, "unreadable", "no", report.message, ""]);
      await sleep(opts.delayMs);
      continue;
    }

    const findings = report.diagnosis.findings.map((f) => f.id).join(" ");
    const q = qualify(report, opts.tier);

    if (!q.qualified) {
      console.log(`${label} — ${report.diagnosis.verdict}, not worth writing about`);
      rows.push([line, report.pageUrl, report.diagnosis.verdict, "no", q.reason, findings]);
      await sleep(opts.delayMs);
      continue;
    }

    const slug = slugOf(report.meta.domain);
    const pngName = `${slug}.png`;
    const pngPath = join(qualifiedDir, pngName);
    const emailPath = join(qualifiedDir, `${slug}.txt`);

    // Cheap resume: a domain already written up is left alone, so a run that
    // dies at 300 of 500 can simply be run again.
    if (await exists(pngPath)) {
      console.log(`${label} — already in the queue, left alone`);
      rows.push([line, report.pageUrl, report.diagnosis.verdict, "yes", q.finding.id, findings]);
      qualifiedCount++;
      continue;
    }

    const parsed = parseOgParams(
      new URLSearchParams({
        template: "gradient",
        title: report.meta.title ?? report.meta.domain,
        subtitle: report.meta.description ?? "",
        site: report.meta.siteName ?? report.meta.domain,
      })
    );
    if (!parsed.success) {
      console.log(`${label} — qualified, but its own text won't render a card`);
      rows.push([line, report.pageUrl, report.diagnosis.verdict, "no", "unrenderable metadata", findings]);
      await sleep(opts.delayMs);
      continue;
    }

    const image = await renderOgImage(parsed.data, { watermark: opts.watermark });
    const bytes = Buffer.from(await new Response(image.body).arrayBuffer());
    await writeFile(pngPath, bytes);

    const { subject, body } = draftEmail(
      { pageUrl: report.pageUrl, domain: report.meta.domain },
      { claim: q.claim, findingId: q.finding.id },
      { signature: opts.signature, checkerBase: opts.base, attachmentName: pngName }
    );
    await writeFile(
      emailPath,
      [`To:      <find a real address — do not guess>`, `Subject: ${subject}`, `Attach:  ${pngName}`, ``, body, ``].join("\n")
    );

    console.log(`${label} — QUALIFIED (${q.finding.id}) → ${slug}`);
    rows.push([line, report.pageUrl, report.diagnosis.verdict, "yes", q.finding.id, findings]);
    qualifiedCount++;
    await sleep(opts.delayMs);
  }

  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  await writeFile(join(opts.out, "results.csv"), `${csv}\n`);

  console.log(
    `\nRead ${urls.length}. ${qualifiedCount} worth writing to, ${skipped} skipped by robots.txt.` +
      `\nQueue: ${qualifiedDir}` +
      `\nEvery row: ${join(opts.out, "results.csv")}` +
      (opts.signature.includes("[your name]")
        ? `\n\nThe drafts are unsigned — pass --signature "— Your Name" before sending.`
        : "")
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
