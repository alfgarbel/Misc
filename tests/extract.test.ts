import { describe, it, expect } from "vitest";
import {
  decodeEntities,
  extractMetadata,
  MAX_DESCRIPTION,
  MAX_TITLE,
} from "@/lib/urlcard/extract";

const page = (head: string, body = "") =>
  `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

describe("decodeEntities", () => {
  it("decodes the named entities that show up in real titles", () => {
    expect(decodeEntities("Tom &amp; Jerry")).toBe("Tom & Jerry");
    expect(decodeEntities("&ldquo;quoted&rdquo;")).toBe("“quoted”");
    expect(decodeEntities("caf&eacute;")).toBe("café");
  });

  it("decodes numeric and hex references", () => {
    expect(decodeEntities("&#8212;")).toBe("—");
    expect(decodeEntities("&#x2014;")).toBe("—");
    expect(decodeEntities("&#128640;")).toBe("🚀");
  });

  it("leaves unknown or malformed references alone", () => {
    expect(decodeEntities("&notarealentity;")).toBe("&notarealentity;");
    expect(decodeEntities("100% &")).toBe("100% &");
    expect(decodeEntities("&#999999999;")).toBe("&#999999999;");
  });
});

describe("extractMetadata", () => {
  it("prefers OpenGraph over everything else", () => {
    const html = page(`
      <title>Title tag</title>
      <meta name="description" content="Meta description">
      <meta name="twitter:title" content="Twitter title">
      <meta property="og:title" content="OG title">
      <meta property="og:description" content="OG description">
      <meta property="og:site_name" content="My Site">
    `);
    const m = extractMetadata(html, "https://example.com/post");
    expect(m.title).toBe("OG title");
    expect(m.description).toBe("OG description");
    expect(m.siteName).toBe("My Site");
  });

  it("falls back to Twitter cards, then to plain head tags", () => {
    const twitter = extractMetadata(
      page(`<title>Title tag</title><meta name="twitter:title" content="Twitter title">`),
      "https://example.com/"
    );
    expect(twitter.title).toBe("Twitter title");

    const plain = extractMetadata(
      page(`<title>Title tag</title><meta name="description" content="Plain">`),
      "https://example.com/"
    );
    expect(plain.title).toBe("Title tag");
    expect(plain.description).toBe("Plain");
  });

  it("handles single quotes, unquoted values and odd spacing", () => {
    const html = page(`
      <meta property='og:title' content='Single quoted'>
      <meta   name = "description"   content = "Spaced out" >
    `);
    const m = extractMetadata(html, "https://example.com/");
    expect(m.title).toBe("Single quoted");
    expect(m.description).toBe("Spaced out");
  });

  it("collapses whitespace inside a multi-line title", () => {
    const m = extractMetadata(
      page(`<title>\n  A  wrapped\n  title\n</title>`),
      "https://example.com/"
    );
    expect(m.title).toBe("A wrapped title");
  });

  it("derives the domain, dropping www", () => {
    expect(extractMetadata(page(""), "https://www.example.com/a/b").domain).toBe("example.com");
    expect(extractMetadata(page(""), "https://blog.example.co.uk/x").domain).toBe("blog.example.co.uk");
  });

  it("resolves a relative image URL against the page", () => {
    const m = extractMetadata(
      page(`<meta property="og:image" content="/img/card.png">`),
      "https://example.com/blog/post"
    );
    expect(m.imageUrl).toBe("https://example.com/img/card.png");
  });

  it("keeps an absolute image URL as-is and handles protocol-relative ones", () => {
    expect(
      extractMetadata(
        page(`<meta property="og:image" content="https://cdn.example.com/a.jpg">`),
        "https://example.com/"
      ).imageUrl
    ).toBe("https://cdn.example.com/a.jpg");

    expect(
      extractMetadata(
        page(`<meta property="og:image" content="//cdn.example.com/a.jpg">`),
        "https://example.com/"
      ).imageUrl
    ).toBe("https://cdn.example.com/a.jpg");
  });

  it("truncates over-long values with an ellipsis", () => {
    const long = "x".repeat(500);
    const m = extractMetadata(
      page(`<meta property="og:title" content="${long}">
            <meta property="og:description" content="${long}">`),
      "https://example.com/"
    );
    expect(m.title!.length).toBe(MAX_TITLE);
    expect(m.description!.length).toBe(MAX_DESCRIPTION);
    expect(m.title!.endsWith("…")).toBe(true);
  });

  it("returns nulls for a page with no metadata at all", () => {
    const m = extractMetadata(page(""), "https://example.com/");
    expect(m.title).toBeNull();
    expect(m.description).toBeNull();
    expect(m.siteName).toBeNull();
    expect(m.imageUrl).toBeNull();
    expect(m.domain).toBe("example.com");
  });

  it("ignores content in the body", () => {
    const m = extractMetadata(
      page(`<title>Real</title>`, `<meta property="og:title" content="Injected">`),
      "https://example.com/"
    );
    expect(m.title).toBe("Real");
  });

  it("treats markup in a value as text, since it is rendered as text", () => {
    const m = extractMetadata(
      page(`<meta property="og:title" content="&lt;script&gt;alert(1)&lt;/script&gt;">`),
      "https://example.com/"
    );
    expect(m.title).toBe("<script>alert(1)</script>");
  });

  it("survives malformed markup rather than throwing", () => {
    for (const html of [
      "<html><head><meta property=og:title content=Unquoted></head>",
      "<meta property='og:title' content='No head at all'>",
      "<html><head><title>Unclosed",
      "",
    ]) {
      expect(() => extractMetadata(html, "https://example.com/")).not.toThrow();
    }
  });

  it("takes the first of duplicated tags, as crawlers do", () => {
    const m = extractMetadata(
      page(`<meta property="og:title" content="First">
            <meta property="og:title" content="Second">`),
      "https://example.com/"
    );
    expect(m.title).toBe("First");
  });

  it("ignores an empty content attribute and moves to the next source", () => {
    const m = extractMetadata(
      page(`<meta property="og:title" content=""><title>Fallback</title>`),
      "https://example.com/"
    );
    expect(m.title).toBe("Fallback");
  });
});
