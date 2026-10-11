import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createOgsmithMcpServer, safeFileName } from "@/lib/mcp/server";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

type Call = { url: URL; init: RequestInit };

/** A stand-in for the deployment: records requests, answers from a table. */
function fakeApi(handler: (call: Call) => Response) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: string | URL, init: RequestInit = {}) => {
    const call = { url: new URL(String(input)), init };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
  return { calls, fetchImpl };
}

async function connect(opts: { apiKey?: string; handler: (call: Call) => Response }) {
  const { calls, fetchImpl } = fakeApi(opts.handler);
  const outputDir = mkdtempSync(join(tmpdir(), "mcp-"));
  const server = createOgsmithMcpServer({
    baseUrl: "https://og.example.com/",
    apiKey: opts.apiKey,
    outputDir,
    fetch: fetchImpl,
  });
  const client = new Client({ name: "test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return { client, calls, outputDir };
}

type Content = { type: string; text?: string; data?: string };

function textOf(result: unknown): string {
  return ((result as { content: Content[] }).content)
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

const png = () => new Response(PNG, { headers: { "content-type": "image/png" } });

describe("the OGsmith MCP server", () => {
  it("offers the card, usage and batch tools", async () => {
    const { client } = await connect({ handler: png });
    const names = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "create_batch",
      "download_batch",
      "get_batch",
      "get_usage",
      "list_batches",
      "list_options",
      "render_card",
    ]);
  });

  it("renders a card, saves it and shows it without leaking the key", async () => {
    const { client, calls, outputDir } = await connect({ apiKey: "og_secret", handler: png });
    const result = await client.callTool({
      name: "render_card",
      arguments: { title: "Hello & welcome", template: "split", accent: "#f43f5e", filename: "hello" },
    });

    expect(result.isError).toBeFalsy();
    const sent = calls[0].url;
    expect(sent.pathname).toBe("/api/og");
    expect(sent.searchParams.get("key")).toBe("og_secret");
    expect(sent.searchParams.get("title")).toBe("Hello & welcome");
    expect(sent.searchParams.get("accent")).toBe("#f43f5e");

    expect(readFileSync(join(outputDir, "hello.png"))).toEqual(PNG);
    const content = (result as { content: Content[] }).content;
    expect(content.find((c) => c.type === "image")?.data).toBe(PNG.toString("base64"));
    const body = textOf(result);
    expect(body).not.toContain("og_secret");
    expect(body).toContain("key=YOUR_KEY");
  });

  it("never lets a placeholder value replace the credentials", async () => {
    const { client, calls } = await connect({ apiKey: "og_secret", handler: png });
    await client.callTool({
      name: "render_card",
      arguments: { tpl: "launch", values: { key: "og_other", sig: "x", headline: "Hi" } },
    });
    const sent = calls[0].url.searchParams;
    expect(sent.get("key")).toBe("og_secret");
    expect(sent.get("sig")).toBeNull();
    expect(sent.get("headline")).toBe("Hi");
  });

  it("reports API validation errors with their details", async () => {
    const { client } = await connect({
      handler: () =>
        Response.json(
          { error: "Invalid parameters", details: ["size: must be one of og, square"] },
          { status: 400 }
        ),
    });
    const result = await client.callTool({ name: "render_card", arguments: { title: "x" } });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("400: Invalid parameters");
    expect(textOf(result)).toContain("size: must be one of og, square");
  });

  it("runs a batch until it finishes", async () => {
    let runs = 0;
    const { client, calls } = await connect({
      apiKey: "og_secret",
      handler: ({ url }) => {
        if (url.pathname === "/api/batches") {
          return Response.json({
            ok: true,
            batch: { id: "b1", total: 25, done: 10, failed: 0, finished: false },
          });
        }
        runs++;
        return Response.json({ ok: true, total: 25, done: 10 + runs * 10 > 25 ? 25 : 10 + runs * 10, failed: 0, finished: runs === 2 });
      },
    });
    const result = await client.callTool({
      name: "create_batch",
      arguments: { rows: [{ key: "a", params: { title: "A" } }] },
    });
    expect(runs).toBe(2);
    expect(calls[0].init.headers).toMatchObject({ Authorization: "Bearer og_secret" });
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ storeImages: true });
    expect(textOf(result)).toContain("25/25 rendered");
  });

  it("asks for a key before account-only tools", async () => {
    const { client, calls } = await connect({ handler: png });
    const result = await client.callTool({ name: "get_usage", arguments: {} });
    expect(result.isError).toBe(true);
    expect(calls).toHaveLength(0);
  });
});

describe("saved file names", () => {
  it("stay inside the output folder", () => {
    expect(safeFileName("../../etc/passwd", "png")).toBe("etc-passwd.png");
    expect(safeFileName("launch post.png", "png")).toBe("launch-post.png");
    expect(safeFileName("...", "zip")).toBe("card.zip");
  });
});
