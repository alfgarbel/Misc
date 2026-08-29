import { parseOgParams } from "@/lib/og/params";
import { renderOgImage } from "@/lib/og/render";
import { postBySlug, allPosts } from "@/lib/blog";

/**
 * Each post's own card, rendered by the same code customers get.
 *
 * A blog about link previews whose own posts preview badly would be a poor
 * advertisement, and this is the cheapest possible way to keep ourselves
 * honest: if the renderer regresses, our own writing is the first thing to
 * look wrong.
 */

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return allPosts().map(({ meta }) => ({ slug: meta.slug }));
}

export default async function PostImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = postBySlug(slug);
  const parsed = parseOgParams(
    new URLSearchParams({
      template: "gradient",
      title: post?.meta.title ?? "OGsmith",
      subtitle: post?.meta.cardSubtitle ?? "Open Graph images as an API",
      site: "ogsmith.app",
    })
  );
  if (!parsed.success) throw new Error("Invalid card parameters for a post");
  return renderOgImage(parsed.data, { watermark: false });
}
