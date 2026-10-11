import { parseOgParams } from "@/lib/og/params";
import { renderOgImage } from "@/lib/og/render";
import { SHOWCASE } from "@/lib/showcase";

export const runtime = "nodejs";
// Fixed inputs, so every card is rendered once at build time.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return SHOWCASE.map((c) => ({ slug: c.slug }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const card = SHOWCASE.find((c) => c.slug === slug);
  if (!card) return new Response("Not found", { status: 404 });
  const parsed = parseOgParams(new URLSearchParams(card.params));
  if (!parsed.success) {
    // Unreachable for the literals in lib/showcase.ts; a build error beats a blank card.
    throw new Error(`Showcase card "${slug}" has invalid parameters`);
  }
  return renderOgImage(parsed.data, { watermark: false });
}
