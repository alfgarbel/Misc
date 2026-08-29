import { describe, it, expect, beforeEach } from "vitest";
import { qualify, draftEmail, subjectFor, type Prospect } from "@/lib/checker/prospect";
import {
  parseRobots,
  robotsAllows,
  robotsAllowsUrl,
  clearRobotsCache,
} from "@/lib/checker/robots";
import { diagnose } from "@/lib/checker/diagnose";
import { extractCardTags } from "@/lib/urlcard/extract";
import type { CardReport } from "@/lib/checker/report";
import type { ImageInspection } from "@/lib/checker/image";
import type { FetchResult } from "@/lib/urlcard/fetch";

function report(html: string, image: ImageInspection | null = null): CardReport {
  const tags = extractCardTags(html);
  const imageUrl = tags.ogImage
    ? new URL(tags.ogImage, "https://acme.com/").toString()
    : null;
  return {
    ok: true,
    pageUrl: "https://acme.com/pricing",
    meta: {
      title: "Acme — pricing",
      description: "What it costs.",
      siteName: "Acme",
      imageUrl,
      domain: "acme.com",
      url: "https://acme.com/pricing",
    },
    tags,
    image,
    diagnosis: diagnose({
      pageUrl: "https://acme.com/pricing",
      tags,
      imageUrl,
      image,
    }),
    cached: false,
  };
}

const good = `<head>
  <title>Acme</title>
  <meta property="og:title" content="Acme — pricing">
  <meta property="og:description" content="What it costs.">
  <meta property="og:image" content="https://acme.com/card.png">
  <meta property="og:url" content="https://acme.com/pricing">
  <meta name="twitter:card" content="summary_large_image">
</head>`;
const bigImage: ImageInspection = {
  ok: true, mimeType: "image/png", bytes: 90_000, width: 1200, height: 630,
};

describe("who is worth writing to", () => {
  it("qualifies a page with no image at all", () => {
    const q = qualify(report("<head><title>Acme</title></head>"));
    expect(q.qualified).toBe(true);
    if (!q.qualified) return;
    expect(q.finding.id).toBe("no-image");
    expect(q.claim).toMatch(/shows no preview image/);
  });

  it("qualifies a broken image link", () => {
    const q = qualify(
      report(good, { ok: false, fault: "unreachable", detail: "404" })
    );
    expect(q.qualified && q.finding.id).toBe("image-unreachable");
  });

  it("qualifies an image too small to appear anywhere", () => {
    const q = qualify(
      report(good, { ok: true, mimeType: "image/png", bytes: 900, width: 120, height: 120 })
    );
    expect(q.qualified).toBe(true);
    if (!q.qualified) return;
    expect(q.claim).toContain("120×120");
  });

  it("does NOT qualify a card that is merely imperfect", () => {
    // A square image and no twitter:card are real findings and bad emails.
    const imperfect = `<head>
      <title>Acme</title>
      <meta property="og:title" content="Acme">
      <meta property="og:image" content="https://acme.com/logo.png">
    </head>`;
    const q = qualify(
      report(imperfect, { ok: true, mimeType: "image/png", bytes: 5000, width: 1024, height: 1024 })
    );
    expect(q.qualified).toBe(false);
    if (q.qualified) return;
    expect(q.reason).toMatch(/only soft findings/);
  });

  it("never qualifies on a missing twitter:card alone", () => {
    // True of a large share of the web. Mailing about it would be spam.
    const noTwitter = `<head>
      <title>Acme</title>
      <meta property="og:title" content="Acme">
      <meta property="og:description" content="d">
      <meta property="og:url" content="https://acme.com/">
      <meta property="og:image" content="https://acme.com/card.png">
    </head>`;
    expect(qualify(report(noTwitter, bigImage)).qualified).toBe(false);
  });

  it("does not qualify a healthy page", () => {
    const q = qualify(report(good, bigImage));
    expect(q.qualified).toBe(false);
    if (q.qualified) return;
    expect(q.reason).toBe("card is fine");
  });

  it("only counts a too-small-for-large-card image on the wide tier", () => {
    const r = report(good, {
      ok: true, mimeType: "image/png", bytes: 3000, width: 400, height: 300,
    });
    expect(qualify(r, "strict").qualified).toBe(false);
    expect(qualify(r, "wide").qualified).toBe(true);
  });

  it("leads with the worst finding when several qualify", () => {
    const q = qualify(report("<head></head>"));
    expect(q.qualified && q.finding.severity).toBe("error");
  });
});

describe("the email", () => {
  const prospect = qualify(report("<head><title>Acme</title></head>")) as Prospect;
  const r = report("<head><title>Acme</title></head>");

  it("states the finding, links the free tool, and offers an opt-out", () => {
    const { subject, body } = draftEmail(
      { pageUrl: r.pageUrl, domain: r.meta.domain },
      { claim: prospect.claim, findingId: prospect.finding.id },
      {
        signature: "— Alf",
        checkerBase: "https://ogsmith.app",
        attachmentName: "acme-com.png",
      }
    );
    expect(subject).toContain("acme.com");
    expect(body).toContain("https://acme.com/pricing");
    expect(body).toContain("acme-com.png");
    expect(body).toContain("https://ogsmith.app/check?url=");
    expect(body).toMatch(/rather not hear from me/i);
    expect(body.endsWith("— Alf")).toBe(true);
  });

  it("does not claim there is no image when the image is merely broken", () => {
    const broken = report(good, { ok: false, fault: "unreachable", detail: "404" });
    const p = qualify(broken) as Prospect;
    expect(subjectFor(broken.meta.domain, p.finding.id)).toMatch(/looks broken/);
    expect(subjectFor(broken.meta.domain, p.finding.id)).not.toMatch(
      /show no preview image/
    );
  });
});

describe("robots.txt", () => {
  beforeEach(() => clearRobotsCache());

  it("reads the wildcard group", () => {
    const rules = parseRobots("User-agent: *\nDisallow: /admin\nDisallow: /private");
    expect(robotsAllows(rules, "/pricing")).toBe(true);
    expect(robotsAllows(rules, "/admin/users")).toBe(false);
  });

  it("prefers a group that names us over the wildcard", () => {
    const rules = parseRobots(
      "User-agent: *\nDisallow: /\n\nUser-agent: OGsmithBot\nDisallow: /secret"
    );
    expect(robotsAllows(rules, "/pricing")).toBe(true);
    expect(robotsAllows(rules, "/secret/x")).toBe(false);
  });

  it("lets a longer Allow carve an exception out of a Disallow", () => {
    const rules = parseRobots("User-agent: *\nDisallow: /docs\nAllow: /docs/public");
    expect(robotsAllows(rules, "/docs/internal")).toBe(false);
    expect(robotsAllows(rules, "/docs/public/a")).toBe(true);
  });

  it("treats an empty Disallow as no restriction", () => {
    const rules = parseRobots("User-agent: *\nDisallow:");
    expect(robotsAllows(rules, "/anything")).toBe(true);
  });

  it("ignores comments and directives it doesn't implement", () => {
    const rules = parseRobots(
      "# hello\nSitemap: https://a.com/sitemap.xml\nUser-agent: *\nCrawl-delay: 10\nDisallow: /x"
    );
    expect(robotsAllows(rules, "/x")).toBe(false);
    expect(robotsAllows(rules, "/y")).toBe(true);
  });

  it("shares one group across consecutive User-agent lines", () => {
    const rules = parseRobots(
      "User-agent: Googlebot\nUser-agent: OGsmithBot\nDisallow: /no"
    );
    expect(robotsAllows(rules, "/no")).toBe(false);
  });

  const robots = (body: string): FetchResult => ({
    ok: true,
    finalUrl: "https://acme.com/robots.txt",
    contentType: "text/plain",
    body: Buffer.from(body),
  });

  it("treats a missing robots.txt as permission", async () => {
    const allowed = await robotsAllowsUrl("https://acme.com/pricing", {
      fetchRobots: async () => ({ ok: false, reason: "http_error", status: 404 }),
    });
    expect(allowed).toBe(true);
  });

  it("treats an unreachable robots.txt as permission, not refusal", async () => {
    const allowed = await robotsAllowsUrl("https://acme.com/pricing", {
      fetchRobots: async () => {
        throw new Error("network down");
      },
    });
    expect(allowed).toBe(true);
  });

  it("refuses a path the file disallows", async () => {
    const allowed = await robotsAllowsUrl("https://acme.com/private/x", {
      fetchRobots: async () => robots("User-agent: *\nDisallow: /private"),
    });
    expect(allowed).toBe(false);
  });

  it("fetches robots.txt once per origin", async () => {
    let fetches = 0;
    const deps = {
      fetchRobots: async () => {
        fetches++;
        return robots("User-agent: *\nDisallow: /private");
      },
    };
    await robotsAllowsUrl("https://acme.com/a", deps);
    await robotsAllowsUrl("https://acme.com/b", deps);
    await robotsAllowsUrl("https://other.com/a", deps);
    expect(fetches).toBe(2);
  });
});
