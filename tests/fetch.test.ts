import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import { checkUrl } from "@/lib/urlcard/safety";
import {
  fetchHtml,
  safeFetch,
  MAX_REDIRECTS,
  FETCH_TIMEOUT_MS,
  type FetchFailure,
} from "@/lib/urlcard/fetch";

let server: Server;
let origin: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", origin);
    const path = url.pathname;
    if (path === "/page") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<html><head><title>Hello</title></head><body>hi</body></html>");
    } else if (path === "/redirect-to-metadata") {
      res.writeHead(302, { Location: "http://169.254.169.254/latest/meta-data/" });
      res.end();
    } else if (path === "/redirect-to-loopback") {
      res.writeHead(301, { Location: "http://127.0.0.1:1/" });
      res.end();
    } else if (path === "/redirect-relative") {
      res.writeHead(302, { Location: "/page" });
      res.end();
    } else if (path === "/loop") {
      res.writeHead(302, { Location: `${origin}/loop` });
      res.end();
    } else if (path === "/huge") {
      res.writeHead(200, { "Content-Type": "text/html" });
      // Claims to be small, then sends far more than the cap allows.
      res.end("x".repeat(2 * 1024 * 1024));
    } else if (path === "/chunked-forever") {
      // No Content-Length at all — the cap has to come from counting bytes
      // as they arrive, since there is nothing to consult up front.
      res.writeHead(200, { "Content-Type": "text/html", "Transfer-Encoding": "chunked" });
      let sent = 0;
      const pump = () => {
        if (sent > 4 * 1024 * 1024 || res.writableEnded) return void res.end();
        sent += 16 * 1024;
        if (res.write("z".repeat(16 * 1024))) setImmediate(pump);
        else res.once("drain", pump);
      };
      pump();
    } else if (path === "/big-page") {
      // A head with the metadata, then a body far past any cap.
      res.writeHead(200, { "Content-Type": "text/html" });
      res.write("<html><head><title>Findable</title></head><body>");
      res.write("p".repeat(3 * 1024 * 1024));
      res.end("</body></html>");
    } else if (path === "/head-split") {
      // The closing tag straddles a chunk boundary.
      res.writeHead(200, { "Content-Type": "text/html" });
      res.write("<html><head><title>Split</title></he");
      setTimeout(() => res.end("ad><body>rest</body></html>"), 10);
    } else if (path === "/no-head-close") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><title>Unclosed head</title><body>x</body></html>");
    } else if (path === "/json") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{}");
    } else if (path === "/slow") {
      setTimeout(() => {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html></html>");
      }, 30_000);
    } else if (path === "/boom") {
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end("error");
    } else if (path === "/no-location") {
      res.writeHead(302);
      res.end();
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

/**
 * Allows only the test server's own origin and defers everything else to
 * the real guard, so redirect targets are judged by production logic.
 */
const testCheck = async (url: string): Promise<{ ok: boolean; reason?: FetchFailure }> => {
  if (url.startsWith(origin)) return { ok: true };
  const r = await checkUrl(url);
  return { ok: r.ok, reason: r.reason };
};

const html = (url: string) =>
  safeFetch(url, {
    maxBytes: 512 * 1024,
    expect: (ct) => ct.includes("text/html") || ct === "",
    check: testCheck,
  });

describe("safeFetch", () => {
  it("fetches a normal page", async () => {
    const r = await html(`${origin}/page`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.body.toString()).toContain("<title>Hello</title>");
      expect(r.contentType).toContain("text/html");
    }
  });

  it("re-checks every redirect hop, blocking one aimed at cloud metadata", async () => {
    // The URL we were handed is fine; where it sends us is not.
    const r = await html(`${origin}/redirect-to-metadata`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("blocked_address");
  });

  it("blocks a redirect aimed at loopback", async () => {
    const r = await html(`${origin}/redirect-to-loopback`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("blocked_address");
  });

  it("follows a relative redirect", async () => {
    const r = await html(`${origin}/redirect-relative`);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.finalUrl).toBe(`${origin}/page`);
  });

  it("gives up on a redirect loop", async () => {
    const r = await html(`${origin}/loop`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too_many_redirects");
  });

  it("stops a response that exceeds the byte cap", async () => {
    const r = await safeFetch(`${origin}/huge`, {
      maxBytes: 64 * 1024,
      check: testCheck,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too_large");
  });

  it("caps a chunked response that never declares a length", async () => {
    // Content-Length is a claim, not a promise, and here there isn't one.
    // The only defence is counting bytes as they arrive and cancelling.
    const r = await safeFetch(`${origin}/chunked-forever`, {
      maxBytes: 64 * 1024,
      check: testCheck,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too_large");
  });

  it("rejects a response that isn't the type we asked for", async () => {
    const r = await html(`${origin}/json`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("wrong_type");
  });

  it("reports an upstream error without leaking its body", async () => {
    const r = await html(`${origin}/boom`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("http_error");
  });

  it("handles a redirect with no Location header", async () => {
    const r = await html(`${origin}/no-location`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("http_error");
  });

  it("allows at most MAX_REDIRECTS hops", () => {
    expect(MAX_REDIRECTS).toBeLessThanOrEqual(5);
  });

  it("gives up on a page that never responds", async () => {
    const started = Date.now();
    const r = await html(`${origin}/slow`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("timeout");
    // A hung upstream must not become a hung render.
    expect(Date.now() - started).toBeLessThan(FETCH_TIMEOUT_MS + 3000);
  }, 20_000);
});

describe("address pinning", () => {
  it("connects to the address the check approved, not to DNS", async () => {
    // `.invalid` is guaranteed never to resolve. If the request succeeds,
    // the connection can only have used the address we pinned — which is
    // what stops a DNS record answering the check and the connection
    // differently.
    const port = (server.address() as AddressInfo).port;
    const r = await safeFetch(`http://pinned.invalid:${port}/page`, {
      maxBytes: 64 * 1024,
      check: async () => ({ ok: true, addresses: ["127.0.0.1"] }),
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body.toString()).toContain("Hello");
  });

  it("fails without a pinned address, proving the hostname really is unresolvable", async () => {
    const port = (server.address() as AddressInfo).port;
    const r = await safeFetch(`http://pinned.invalid:${port}/page`, {
      maxBytes: 64 * 1024,
      check: async () => ({ ok: true }),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("network");
  });
});

describe("fetchHtml on pages bigger than the cap", () => {
  const htmlOpts = {
    maxBytes: 512 * 1024,
    expect: (ct: string) => ct.includes("text/html") || ct === "",
    stopAfter: "</head",
    truncate: true,
    check: testCheck,
  };

  it("reads a huge page successfully, stopping at the end of the head", async () => {
    // Real sites ship megabyte-plus documents; failing on them would fail
    // on a good share of the web, when everything we want is in <head>.
    const r = await safeFetch(`${origin}/big-page`, htmlOpts);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.body.toString()).toContain("<title>Findable</title>");
      // Stopped early rather than reading three megabytes of body.
      expect(r.body.length).toBeLessThan(64 * 1024);
    }
  });

  it("finds the marker even when it straddles a chunk boundary", async () => {
    const r = await safeFetch(`${origin}/head-split`, htmlOpts);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body.toString()).toContain("<title>Split</title>");
  });

  it("still returns a page that never closes its head", async () => {
    const r = await safeFetch(`${origin}/no-head-close`, htmlOpts);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body.toString()).toContain("Unclosed head");
  });

  it("truncates rather than failing when there is no marker and no end", async () => {
    const r = await safeFetch(`${origin}/chunked-forever`, {
      ...htmlOpts,
      maxBytes: 32 * 1024,
      stopAfter: undefined,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body.length).toBeLessThanOrEqual(32 * 1024);
  });

  it("still refuses a truncated image, where half a file is no file", async () => {
    const r = await safeFetch(`${origin}/chunked-forever`, {
      maxBytes: 32 * 1024,
      check: testCheck,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too_large");
  });
});

describe("the real guard is what production uses", () => {
  it("fetchHtml refuses loopback without any injected checker", async () => {
    // Same server, same URL — but through the default check.
    const r = await fetchHtml(`${origin}/page`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("blocked_address");
  });

  it("fetchHtml refuses the metadata address", async () => {
    const r = await fetchHtml("http://169.254.169.254/latest/meta-data/");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("blocked_address");
  });
});
