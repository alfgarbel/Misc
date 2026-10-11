import { createElement } from "react";
import { prerender } from "react-dom/static";
import DocsContent from "@/components/docs/DocsContent";
import { appUrl } from "@/lib/stripe";
import { htmlToMarkdown } from "@/lib/llms";

export const dynamic = "force-static";

/** The whole API reference as Markdown, rendered from the same component as /docs. */
export async function GET() {
  const base = appUrl().replace(/\/$/, "");
  const { prelude } = await prerender(createElement(DocsContent, { base }));
  const html = await new Response(prelude).text();
  return new Response(htmlToMarkdown(html, base), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
