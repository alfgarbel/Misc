import { decodeEntities } from "./urlcard/extract";
import { PLANS } from "./plans";
import { TEMPLATES } from "./og/params";
import { SIZES, SIZE_IDS } from "./og/sizes";
import { TRIAL_DAYS } from "./trial";
import { allPosts } from "./blog";
import { contactEmail } from "./stripe";
import { PLATFORM_PAGES } from "./checker/platforms";
import { COMPARISONS } from "./compare";

/**
 * Machine-readable descriptions of OGsmith for search engines and AI
 * assistants: schema.org JSON-LD, /llms.txt, /llms-full.txt and
 * /openapi.json. Prices and limits come from PLANS so none of them can
 * disagree with the pricing page.
 */

const SUMMARY =
  "OGsmith is a hosted API that turns a URL or a few query parameters into an Open Graph social card image (PNG), so links shared on X, LinkedIn, Slack, WhatsApp, Discord and Facebook show a proper preview.";

/** JSON for a <script type="application/ld+json">, safe inside HTML. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function organizationJsonLd(base: string) {
  const email = contactEmail();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "OGsmith",
    url: `${base}/`,
    logo: `${base}/icon.svg`,
    ...(email ? { email } : {}),
  };
}

export function softwareJsonLd(base: string) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "OGsmith",
    url: `${base}/`,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    description: SUMMARY,
    offers: Object.values(PLANS).map((plan) => ({
      "@type": "Offer",
      name: plan.name,
      price: plan.priceMonthlyUsd,
      priceCurrency: "USD",
      description: `${plan.monthlyRenders.toLocaleString("en-US")} renders per month${
        plan.watermark ? ", watermarked after the trial" : ", no watermark"
      }.`,
      url: `${base}/pricing`,
    })),
  };
}

export function llmsTxt(base: string): string {
  const plans = Object.values(PLANS)
    .map(
      (p) =>
        `- ${p.name}: $${p.priceMonthlyUsd}/month, ${p.monthlyRenders.toLocaleString("en-US")} renders${
          p.watermark ? ` (small watermark after a ${TRIAL_DAYS}-day trial)` : ", no watermark"
        }`
    )
    .join("\n");
  const posts = allPosts()
    .map(({ meta }) => `- [${meta.title}](${base}/blog/${meta.slug}): ${meta.description}`)
    .join("\n");
  return `# OGsmith

> ${SUMMARY}

One GET request returns the image: \`${base}/api/og?key=og_…&title=My%20post\`. With \`url=\` OGsmith reads the page's own title, description and image and builds the card from them, so a site can add every page's card with a single meta tag. No headless browser and no design tool are needed.

Pricing:
${plans}

There are no overage charges: rendering stops at the monthly quota.

## Docs

- [API reference](${base}/docs): parameters, sizes, signed URLs, cards from a URL, custom templates, A/B tests, cache refresh, batches, webhooks and quotas.
- [Full API reference as Markdown](${base}/llms-full.txt)
- [OpenAPI description](${base}/openapi.json) of \`/api/og\` and \`/api/usage\`.
- [Templates](${base}/templates): every built-in layout, rendered live.
- [For marketing teams](${base}/for/marketing): visual editor, A/B tests by page and cache refresh, set up once by a developer.

## Tools

- [Link preview checker](${base}/check): free, no signup. Shows how a link looks on X, LinkedIn, Slack, Discord, WhatsApp, Facebook and iMessage, and what is wrong with its Open Graph tags.
${PLATFORM_PAGES.map((p) => `- [${p.h1}](${base}/check/${p.slug}): ${p.description}`).join("\n")}
- [Pricing](${base}/pricing)

## Comparisons

${COMPARISONS.map((c) => `- [OGsmith vs ${c.name}](${base}/vs/${c.slug}): ${c.description}`).join("\n")}

## Blog

${posts}

## Optional

- MCP server: \`npm run mcp\` in the OGsmith repository starts a Model Context Protocol server, so an assistant can render cards, list templates, check usage and run batches with an ordinary API key.
`;
}

const BLOCKS = /^(h[1-6]|p|ul|ol|li|pre|table|thead|tbody|tr|div|section)$/;

/**
 * Turns the markup our own docs render into Markdown. It is not a general
 * HTML converter: it knows the handful of elements DocsContent uses, and
 * anything else is reduced to its text.
 */
export function htmlToMarkdown(html: string, base: string): string {
  let out = html;

  // Code blocks first, so nothing inside them is treated as markup.
  const codeBlocks: string[] = [];
  out = out.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/g, (_, code: string) => {
    codeBlocks.push(decodeEntities(code.replace(/<[^>]+>/g, "")).replace(/\n+$/, ""));
    return `\n\n\u0000${codeBlocks.length - 1}\u0000\n\n`;
  });

  out = out.replace(/<table[^>]*>([\s\S]*?)<\/table>/g, (_, table: string) => {
    const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((row) =>
      [...row[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((cell) =>
        inline(cell[1], base).replace(/\|/g, "\\|")
      )
    );
    if (!rows.length) return "";
    const [head, ...body] = rows;
    const line = (cells: string[]) => `| ${cells.join(" | ")} |`;
    return `\n\n${[line(head), line(head.map(() => "---")), ...body.map(line)].join("\n")}\n\n`;
  });

  out = out
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/g, (_, level: string, text: string) =>
      `\n\n${"#".repeat(Number(level))} ${inline(text, base)}\n\n`
    )
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/g, (_, text: string) => `\n- ${inline(text, base)}`)
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/g, (_, text: string) => `\n\n${inline(text, base)}\n\n`)
    .replace(/<\/?([a-z0-9]+)[^>]*>/g, (tag, name: string) => (BLOCKS.test(name) ? "\n" : tag));

  out = inline(out, base, false)
    .replace(/\u0000(\d+)\u0000/g, (_, i: string) => "```\n" + codeBlocks[Number(i)] + "\n```")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return `${out}\n`;
}

function inline(html: string, base: string, collapse = true): string {
  let text = html
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/g, (_, c: string) => `\`${c.replace(/<[^>]+>/g, "")}\``)
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/g, "**$2**")
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/g, "*$2*")
    .replace(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, (_, href: string, label: string) => {
      const target = href.startsWith("/") ? `${base}${href}` : href.startsWith("#") ? `${base}/docs${href}` : href;
      return `[${label.replace(/<[^>]+>/g, "")}](${decodeEntities(target)})`;
    })
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<(?!\/?(h[1-6]|p|ul|ol|li|pre|table|thead|tbody|tr|div|section)\b)[^>]+>/g, "");
  text = decodeEntities(text);
  return collapse ? text.replace(/\s+/g, " ").trim() : text;
}

export function openApiSpec(base: string) {
  const sizes = SIZE_IDS.map((id) => `${id} (${SIZES[id].width}x${SIZES[id].height})`).join(", ");
  const query = (
    name: string,
    description: string,
    schema: Record<string, unknown> = { type: "string" }
  ) => ({ name, in: "query", required: false, description, schema });
  const error = {
    description: "Error",
    content: {
      "application/json": {
        schema: { type: "object", properties: { error: { type: "string" } } },
      },
    },
  };

  return {
    openapi: "3.1.0",
    info: {
      title: "OGsmith API",
      version: "1.0.0",
      description: `${SUMMARY} Full reference: ${base}/docs`,
    },
    servers: [{ url: base }],
    components: {
      securitySchemes: {
        apiKeyQuery: { type: "apiKey", in: "query", name: "key" },
        bearer: { type: "http", scheme: "bearer", description: "An og_… API key." },
      },
    },
    paths: {
      "/api/og": {
        get: {
          operationId: "renderCard",
          summary: "Render a social card PNG",
          description:
            "Returns a PNG for an og:image tag. Without a key it renders a watermarked, rate-limited demo. Parameters left out fall back to the account's brand defaults.",
          security: [{}, { apiKeyQuery: [] }],
          parameters: [
            query("title", "Main headline, up to 200 characters.", { type: "string", maxLength: 200 }),
            query("subtitle", "Supporting line, up to 300 characters.", { type: "string", maxLength: 300 }),
            query("site", "Site or brand name in the card footer.", { type: "string", maxLength: 100 }),
            query("template", "Built-in layout.", { type: "string", enum: [...TEMPLATES], default: "gradient" }),
            query("theme", "Base color scheme.", { type: "string", enum: ["dark", "light"], default: "dark" }),
            query("accent", "Accent hex color; URL-encode the hash (%236366f1).", {
              type: "string",
              pattern: "^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$",
              default: "#6366f1",
            }),
            query("size", `Canvas: ${sizes}.`, { type: "string", enum: [...SIZE_IDS], default: "og" }),
            query("url", "Read this https page and build the card from its title, description, site name and image.", {
              type: "string",
              format: "uri",
            }),
            query("tpl", "Slug of a custom template from the visual editor. Replaces template."),
            query("exp", "Slug of an A/B experiment; picks a design variant for the page."),
            query("k", "Stable page id for exp, such as a post slug.", { type: "string", maxLength: 500 }),
            query("v", "Cache-busting token that makes social platforms re-fetch the card.", {
              type: "string",
              maxLength: 32,
            }),
            query("acct", "Account id, for signed URLs (with sig) instead of key."),
            query("sig", "HMAC-SHA256 signature of the other parameters. See /docs#signed-urls."),
          ],
          responses: {
            "200": { description: "The card.", content: { "image/png": { schema: { type: "string", format: "binary" } } } },
            "400": error,
            "401": error,
            "429": error,
          },
        },
      },
      "/api/usage": {
        get: {
          operationId: "getUsage",
          summary: "This month's usage and quota",
          security: [{ bearer: [] }, { apiKeyQuery: [] }],
          responses: {
            "200": {
              description: "Usage for the key's account.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      month: { type: "string", example: "2026-10" },
                      plan: { type: "string", enum: Object.keys(PLANS) },
                      used: { type: "integer" },
                      limit: { type: "integer" },
                      remaining: { type: "integer" },
                      watermark: { type: "boolean" },
                      trialEndsAt: { type: ["string", "null"], format: "date-time" },
                    },
                  },
                },
              },
            },
            "401": error,
          },
        },
      },
    },
  };
}
