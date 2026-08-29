import { parseOgParams } from "@/lib/og/params";
import { renderOgImage } from "@/lib/og/render";

/**
 * The site's own card.
 *
 * A product that sells Open Graph images shipped without one, which its
 * own checker duly reported. This uses the same renderer every customer
 * gets, so if the card is wrong here it's wrong for everyone — the most
 * honest kind of dogfooding available.
 *
 * Next's file convention emits the og:image and twitter:image tags from
 * this, so there's no public unauthenticated render endpoint to abuse:
 * the parameters are fixed here in the source.
 */

export const runtime = "nodejs";
export const alt = "OGsmith — Open Graph images as an API";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const parsed = parseOgParams(
    new URLSearchParams({
      template: "gradient",
      title: "Social cards for every page, from one URL",
      subtitle:
        "Render a perfect 1200×630 Open Graph image on demand. No headless browser, no design tool, no build step.",
      site: "ogsmith.app",
    })
  );
  if (!parsed.success) {
    // Unreachable: the parameters are literals above. Throwing beats
    // serving a blank card, because a build failure is visible.
    throw new Error("The site's own card parameters are invalid");
  }
  return renderOgImage(parsed.data, { watermark: false });
}
