import { parseOgParams } from "@/lib/og/params";
import { renderOgImage } from "@/lib/og/render";
import { readFile } from "fs/promises";
import { join } from "path";
import { ALL_SHOWCASE_CARDS, type ShowcaseCard } from "@/lib/showcase";
import type { HeroImage } from "@/lib/urlcard/image";

/** Stands in for the page image ?url= would have fetched. */
async function heroFor(card: ShowcaseCard): Promise<HeroImage | null> {
  if (!card.heroAsset) return null;
  const { file, width, height } = card.heroAsset;
  const bytes = await readFile(join(process.cwd(), "public", "showcase-assets", file));
  const type = file.endsWith(".png") ? "image/png" : "image/jpeg";
  return { dataUrl: `data:${type};base64,${bytes.toString("base64")}`, width, height };
}

export const runtime = "nodejs";
// Fixed inputs, so every card is rendered once at build time.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return ALL_SHOWCASE_CARDS.map((c) => ({ slug: c.slug }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const card = ALL_SHOWCASE_CARDS.find((c) => c.slug === slug);
  if (!card) return new Response("Not found", { status: 404 });
  const parsed = parseOgParams(new URLSearchParams(card.params));
  if (!parsed.success) {
    // Unreachable for the literals in lib/showcase.ts; a build error beats a blank card.
    throw new Error(`Showcase card "${slug}" has invalid parameters`);
  }
  return renderOgImage(parsed.data, { watermark: false, hero: await heroFor(card) });
}
