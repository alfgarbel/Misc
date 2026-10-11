import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DocsContent from "@/components/docs/DocsContent";
import { htmlToMarkdown, llmsTxt, openApiSpec, softwareJsonLd } from "@/lib/llms";
import { PLANS } from "@/lib/plans";

const base = "https://ogsmith.example";

describe("docs as Markdown", () => {
  it("keeps headings, tables, code and links", () => {
    const md = htmlToMarkdown(
      `<h2 id="x">Signed <code>URLs</code></h2><p>See <a href="#sizes">Sizes</a> &amp; <a href="/check">the checker</a>.</p>` +
        `<table><thead><tr><th>Param</th><th>Type</th></tr></thead><tbody><tr><td>size</td><td>og | square</td></tr></tbody></table>` +
        `<pre class="c">GET /api/og?a=1&amp;b=&lt;2&gt;</pre><ul><li>One</li><li>Two</li></ul>`,
      base
    );
    expect(md).toContain("## Signed `URLs`");
    expect(md).toContain(`[Sizes](${base}/docs#sizes) & [the checker](${base}/check)`);
    expect(md).toContain("| Param | Type |\n| --- | --- |\n| size | og \\| square |");
    expect(md).toContain("```\nGET /api/og?a=1&b=<2>\n```");
    expect(md).toContain("- One\n- Two");
  });

  it("renders the real reference without leftover markup", () => {
    const md = htmlToMarkdown(renderToStaticMarkup(createElement(DocsContent, { base })), base);
    expect(md.startsWith("# API reference")).toBe(true);
    expect(md).toContain("## Signed URLs");
    expect(md).toContain("| key | string |");
    expect(md).not.toMatch(/<\/?(div|p|span|code|a|table|tr|td)\b/);
    expect(md).not.toContain("&amp;");
  });
});

describe("machine-readable descriptions", () => {
  it("quote the same prices as the plans", () => {
    const txt = llmsTxt(base);
    for (const plan of Object.values(PLANS)) {
      expect(txt).toContain(`${plan.name}: $${plan.priceMonthlyUsd}/month`);
    }
    const offers = softwareJsonLd(base).offers.map((o) => o.price);
    expect(offers).toEqual(Object.values(PLANS).map((p) => p.priceMonthlyUsd));
  });

  it("describes the render endpoint in OpenAPI", () => {
    const spec = openApiSpec(base);
    expect(spec.servers[0].url).toBe(base);
    const names = spec.paths["/api/og"].get.parameters.map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(["title", "url", "template", "size", "sig"]));
  });
});

describe("docs split into pages", () => {
  it("gives every section its own page in the sitemap and llms.txt", async () => {
    const { DOC_SECTIONS } = await import("@/components/docs/sections");
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = sitemap().map((e) => e.url);
    const txt = llmsTxt(base);
    for (const s of DOC_SECTIONS) {
      expect(urls.some((u) => u.endsWith(`/docs/${s.slug}`))).toBe(true);
      expect(txt).toContain(`/docs/${s.slug}`);
    }
  });

  it("keeps every section in the one-page Markdown", async () => {
    const { DOC_SECTIONS } = await import("@/components/docs/sections");
    const md = htmlToMarkdown(renderToStaticMarkup(createElement(DocsContent, { base })), base);
    for (const s of DOC_SECTIONS.filter((s) => !s.ownHeadings)) {
      expect(md).toContain(`## ${s.title}`);
    }
    expect(md).toContain("## Quotas & caching");
    expect(md).toContain(`(${base}/docs/cache-refresh)`);
  });
});
