import { appUrl } from "@/lib/stripe";
import { llmsTxt } from "@/lib/llms";

export const dynamic = "force-static";

/** A short Markdown map of the site for AI assistants (llmstxt.org). */
export function GET() {
  return new Response(llmsTxt(appUrl().replace(/\/$/, "")), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
