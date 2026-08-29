import type { CardReport } from "./report";
import type { Finding } from "./diagnose";

/**
 * Decides whether a page is worth writing to a stranger about.
 *
 * The bar is deliberately high and the reason is not politeness, it is that
 * the email only works if its claim is undeniable. "Your page shows no
 * image when shared" is a fact the reader can check in ten seconds.
 * "Your aspect ratio is 1.4:1" is an opinion, and an unsolicited one.
 *
 * So most findings never qualify — a missing og:description, a long title,
 * a missing twitter:card. That last one in particular is true of a large
 * share of the web; mailing people about it would be spam with a
 * spreadsheet behind it.
 */

/** strict: only cards that are visibly broken. wide: adds badly degraded. */
export type QualifyTier = "strict" | "wide";

const STRICT_RULES = new Set([
  "no-image",
  "twitter-image-only",
  "image-unreachable",
  "image-not_an_image",
  "image-tiny",
]);

const WIDE_EXTRA_RULES = new Set(["image-small", "image-unsupported_format"]);

export interface Prospect {
  qualified: true;
  /** The finding the email leads with. */
  finding: Finding;
  /** One factual clause, completing "your page …". */
  claim: string;
}

export interface NotAProspect {
  qualified: false;
  /** Why not, for the review queue — never shown to anyone outside. */
  reason: string;
}

export type Qualification = Prospect | NotAProspect;

function claimFor(finding: Finding, report: CardReport): string {
  const img = report.image?.ok ? report.image : null;
  switch (finding.id) {
    case "no-image":
      return "shows no preview image at all when someone shares it — on LinkedIn, Slack or WhatsApp the link arrives as plain text";
    case "twitter-image-only":
      return "has a preview image for X, but not for LinkedIn, Facebook, Slack, Discord or WhatsApp — those all read og:image, and it isn't there";
    case "image-unreachable":
      return "points at a preview image that can't be fetched, so platforms fall back to a bare text link";
    case "image-not_an_image":
      return "points at a preview image URL that doesn't return an image";
    case "image-tiny":
      return img
        ? `has a preview image of ${img.width}×${img.height}, which is below the size platforms will display at all`
        : "has a preview image too small for platforms to display";
    case "image-small":
      return img
        ? `has a preview image of ${img.width}×${img.height}, too small for the large card — it shows as a small thumbnail instead of a banner`
        : "has a preview image too small for the large card";
    case "image-unsupported_format":
      return "uses an image format that most platforms won't render in a link preview";
    default:
      return finding.title;
  }
}

export function qualify(
  report: CardReport,
  tier: QualifyTier = "strict"
): Qualification {
  const allowed =
    tier === "wide"
      ? new Set([...STRICT_RULES, ...WIDE_EXTRA_RULES])
      : STRICT_RULES;

  // Findings are already ordered worst-first, so the first match is the
  // strongest thing we can honestly lead with.
  const finding = report.diagnosis.findings.find((f) => allowed.has(f.id));
  if (!finding) {
    return {
      qualified: false,
      reason:
        report.diagnosis.findings.length === 0
          ? "card is fine"
          : `only soft findings (${report.diagnosis.findings.map((f) => f.id).join(", ")})`,
    };
  }
  return { qualified: true, finding, claim: claimFor(finding, report) };
}

/** A subject that matches the actual finding, rather than assuming the worst. */
export function subjectFor(report: CardReport, prospect: Prospect): string {
  const domain = report.meta.domain;
  switch (prospect.finding.id) {
    case "no-image":
      return `${domain} — your links show no preview image when shared`;
    case "twitter-image-only":
      return `${domain} — LinkedIn and Slack can't see your preview image`;
    case "image-unreachable":
    case "image-not_an_image":
      return `${domain} — your og:image link looks broken`;
    case "image-tiny":
    case "image-small":
      return `${domain} — your preview image is too small to show properly`;
    default:
      return `${domain} — a problem with your link previews`;
  }
}

export interface EmailDraft {
  subject: string;
  body: string;
}

/**
 * The email. Short, one claim, and it names the free tool rather than the
 * paid one — the attachment is already the argument, and a pitch on top of
 * it reads as a pitch.
 */
export function draftEmail(
  report: CardReport,
  prospect: Prospect,
  opts: { signature: string; checkerBase: string; attachmentName: string }
): EmailDraft {
  const url = report.pageUrl;
  const checkUrl = `${opts.checkerBase.replace(/\/$/, "")}/check?url=${encodeURIComponent(url)}`;

  const body = [
    `Hi,`,
    ``,
    `I was looking at ${url} and noticed it ${prospect.claim}.`,
    ``,
    `I've attached what it could look like (${opts.attachmentName}) — that's generated from the page's own title and description, nothing invented. Adding it is one meta tag in your <head>.`,
    ``,
    `You don't need me for any of this. The checker that found it is free and needs no account, and it'll show you the same thing for any other page:`,
    `${checkUrl}`,
    ``,
    `If you'd rather not hear from me, say the word and I won't write again.`,
    ``,
    opts.signature,
  ].join("\n");

  return { subject: subjectFor(report, prospect), body };
}
