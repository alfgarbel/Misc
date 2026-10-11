/**
 * An MCP server over the public OGsmith API, so an assistant like Claude can
 * design cards in conversation: render one, look at it, adjust, save it.
 *
 * It talks to a running deployment over HTTP with an ordinary API key, the
 * same way a customer's script would. That keeps quotas, brand defaults,
 * custom templates and experiments behaving exactly as they do for real
 * traffic, instead of re-implementing any of them here.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TEMPLATES } from "../og/params";
import { SIZES, SIZE_IDS } from "../og/sizes";

export interface OgsmithMcpOptions {
  /** Base URL of the deployment, e.g. https://ogsmith.example.com */
  baseUrl: string;
  /** An og_… key. Without one, renders are the watermarked demo. */
  apiKey?: string;
  /** Where rendered PNGs and batch zips are written. */
  outputDir: string;
  fetch?: typeof fetch;
}

type ToolResult = {
  content: (
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
  )[];
  isError?: boolean;
};

const BATCH_RUN_LIMIT = 60;

/** Credentials are supplied by the server, never by a tool argument. */
const AUTH_PARAMS = new Set(["key", "acct", "sig"]);

function text(value: string): ToolResult {
  return { content: [{ type: "text", text: value }] };
}

function failure(message: string): ToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

/** File names come from the model; keep them inside the output folder. */
export function safeFileName(name: string, ext: string): string {
  const base = name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 80);
  return `${base || "card"}.${ext}`;
}

function stamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
}

/** Turns an API error body into one readable message. */
async function errorOf(res: Response): Promise<string> {
  const body = await res.text();
  try {
    const json = JSON.parse(body) as { error?: string; details?: string[] };
    const details = json.details?.length ? `\n- ${json.details.join("\n- ")}` : "";
    return `OGsmith returned ${res.status}: ${json.error ?? body}${details}`;
  } catch {
    return `OGsmith returned ${res.status}: ${body.slice(0, 500)}`;
  }
}

export function createOgsmithMcpServer(options: OgsmithMcpOptions): McpServer {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const outputDir = resolve(options.outputDir);
  const doFetch = options.fetch ?? fetch;
  const apiKey = options.apiKey || undefined;

  const authHeaders: Record<string, string> = apiKey
    ? { Authorization: `Bearer ${apiKey}` }
    : {};

  async function api(path: string, init: RequestInit = {}): Promise<Response> {
    return doFetch(`${baseUrl}${path}`, {
      ...init,
      headers: { ...authHeaders, ...(init.headers as Record<string, string>) },
    });
  }

  async function save(name: string, data: Buffer): Promise<string> {
    await mkdir(outputDir, { recursive: true });
    const path = join(outputDir, name);
    await writeFile(path, data);
    return path;
  }

  const server = new McpServer({ name: "ogsmith", version: "0.1.0" });

  server.registerTool(
    "render_card",
    {
      title: "Render a card",
      description:
        "Renders a social card PNG through the OGsmith API, saves it locally and shows it. " +
        "Use it to iterate on a design: render, look, adjust a parameter, render again. " +
        "Parameters left out fall back to the account's brand defaults. " +
        "Returns the image URL to put in an og:image meta tag.",
      inputSchema: {
        title: z.string().min(1).max(200).optional().describe("Main headline."),
        subtitle: z.string().max(300).optional().describe("Supporting line under the title."),
        site: z.string().max(100).optional().describe("Site or brand name in the card footer."),
        template: z.enum(TEMPLATES).optional().describe("Built-in layout."),
        theme: z.enum(["dark", "light"]).optional(),
        accent: z
          .string()
          .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
          .optional()
          .describe("Accent hex color like #f43f5e."),
        size: z
          .enum(SIZE_IDS)
          .optional()
          .describe(
            `Canvas: ${SIZE_IDS.map((id) => `${id} ${SIZES[id].width}x${SIZES[id].height}`).join(", ")}.`
          ),
        url: z
          .string()
          .url()
          .optional()
          .describe("Read this page's title, description and image into the card. Needs an API key."),
        tpl: z
          .string()
          .optional()
          .describe("Slug of a custom template from the visual editor. Replaces template."),
        values: z
          .record(z.string(), z.string())
          .optional()
          .describe("Extra {{placeholder}} values for a custom template (tpl)."),
        exp: z.string().optional().describe("Experiment slug; picks a variant for the page given by k or url."),
        k: z.string().max(500).optional().describe("Stable page id for exp, like a post slug."),
        v: z.string().max(32).optional().describe("Cache-busting token, to make platforms re-fetch."),
        filename: z.string().optional().describe("Name for the saved PNG, without extension."),
      },
    },
    async (args) => {
      const params = new URLSearchParams();
      const { values, filename, ...named } = args;
      for (const [key, value] of Object.entries({ ...values, ...named })) {
        if (AUTH_PARAMS.has(key)) continue;
        if (value !== undefined && value !== "") params.set(key, String(value));
      }

      // /api/og authenticates from the query string only, like the URLs
      // customers paste into their meta tags.
      const request = new URLSearchParams(params);
      if (apiKey) request.set("key", apiKey);

      let res: Response;
      try {
        res = await api(`/api/og?${request.toString()}`);
      } catch (err) {
        return failure(`Could not reach OGsmith at ${baseUrl}: ${(err as Error).message}`);
      }
      if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) {
        return failure(await errorOf(res));
      }

      const png = Buffer.from(await res.arrayBuffer());
      const path = await save(safeFileName(filename ?? `card-${stamp()}`, "png"), png);
      // The key is a credential; never echo it back into the conversation.
      const shareable = `${baseUrl}/api/og?${apiKey ? "key=YOUR_KEY&" : ""}${params.toString()}`;
      const notes = [
        `Saved: ${path}`,
        `Image URL: ${shareable}`,
        `Meta tag: <meta property="og:image" content="${shareable.replace(/&/g, "&amp;")}">`,
      ];
      if (!apiKey) notes.push("No OGSMITH_API_KEY set, so this is the watermarked demo render.");
      return {
        content: [
          { type: "text", text: notes.join("\n") },
          { type: "image", data: png.toString("base64"), mimeType: "image/png" },
        ],
      };
    }
  );

  server.registerTool(
    "list_options",
    {
      title: "List templates and sizes",
      description: "Lists the built-in templates, canvas sizes and themes render_card accepts.",
      inputSchema: {},
    },
    async () =>
      text(
        [
          `Templates: ${TEMPLATES.join(", ")}`,
          "Themes: dark, light",
          "Sizes:",
          ...SIZE_IDS.map(
            (id) => `- ${id}: ${SIZES[id].width}x${SIZES[id].height}, ${SIZES[id].blurb}`
          ),
          `Server: ${baseUrl}`,
          `Output folder: ${outputDir}`,
        ].join("\n")
      )
  );

  server.registerTool(
    "get_usage",
    {
      title: "Check usage",
      description: "Shows the account's plan, renders used this month and what remains.",
      inputSchema: {},
    },
    async () => {
      if (!apiKey) return failure("Set OGSMITH_API_KEY to check usage.");
      const res = await api("/api/usage");
      if (!res.ok) return failure(await errorOf(res));
      return text(JSON.stringify(await res.json(), null, 2));
    }
  );

  server.registerTool(
    "create_batch",
    {
      title: "Render a batch",
      description:
        "Renders many cards in one go, one row per card, and runs the batch to completion. " +
        "Each row's params are the same parameters render_card takes. " +
        "Use download_batch afterwards to save the zip.",
      inputSchema: {
        name: z.string().max(80).optional(),
        rows: z
          .array(
            z.object({
              key: z.string().max(200).optional().describe("Stable id; also the file name in the zip."),
              params: z.record(z.string(), z.string()),
            })
          )
          .min(1),
        storeImages: z
          .boolean()
          .optional()
          .describe("Keep the rendered images for 24h so the zip can be downloaded."),
      },
    },
    async ({ name, rows, storeImages }) => {
      if (!apiKey) return failure("Set OGSMITH_API_KEY to render batches.");
      const res = await api("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, rows, storeImages: storeImages ?? true }),
      });
      if (!res.ok) return failure(await errorOf(res));
      const created = (await res.json()) as {
        batch: { id: string; finished: boolean; total: number; done: number; failed: number };
      };

      let state = created.batch;
      for (let i = 0; !state.finished && i < BATCH_RUN_LIMIT; i++) {
        const run = await api(`/api/batches/${state.id}/run`, { method: "POST" });
        if (!run.ok) return failure(await errorOf(run));
        state = { ...state, ...((await run.json()) as typeof state) };
      }
      return text(
        `Batch ${state.id}: ${state.done}/${state.total} rendered, ${state.failed} failed` +
          (state.finished ? "." : ". Not finished yet; call get_batch or create_batch again later.")
      );
    }
  );

  server.registerTool(
    "list_batches",
    {
      title: "List batches",
      description: "Lists the account's batches, newest first.",
      inputSchema: {},
    },
    async () => {
      if (!apiKey) return failure("Set OGSMITH_API_KEY to list batches.");
      const res = await api("/api/batches");
      if (!res.ok) return failure(await errorOf(res));
      return text(JSON.stringify(await res.json(), null, 2));
    }
  );

  server.registerTool(
    "get_batch",
    {
      title: "Batch details",
      description: "Shows a batch's progress and each row's status or error.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      if (!apiKey) return failure("Set OGSMITH_API_KEY to read batches.");
      const res = await api(`/api/batches/${encodeURIComponent(id)}`);
      if (!res.ok) return failure(await errorOf(res));
      return text(JSON.stringify(await res.json(), null, 2));
    }
  );

  server.registerTool(
    "download_batch",
    {
      title: "Download batch zip",
      description: "Saves a finished batch's images as a zip in the output folder.",
      inputSchema: { id: z.string(), filename: z.string().optional() },
    },
    async ({ id, filename }) => {
      if (!apiKey) return failure("Set OGSMITH_API_KEY to download batches.");
      const res = await api(`/api/batches/${encodeURIComponent(id)}/download`);
      if (!res.ok) return failure(await errorOf(res));
      const zip = Buffer.from(await res.arrayBuffer());
      const path = await save(safeFileName(filename ?? `batch-${id}`, "zip"), zip);
      return text(`Saved: ${path}`);
    }
  );

  return server;
}
