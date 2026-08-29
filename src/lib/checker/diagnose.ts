import type { CardTags } from "../urlcard/extract";
import type { ImageInspection } from "./image";

/**
 * Decides what is wrong with a page's link preview.
 *
 * Pure on purpose: every rule here is a claim about how social platforms
 * behave, and claims need tests. Fetching lives in `report.ts`.
 *
 * Platform behaviour is described as what typically happens, because that
 * is the truth — these renderers change without notice and none of them
 * publish a contract. Where a number is asserted it is one the platform
 * itself documents (Facebook's 200x200 floor, X's 300x157 for a large
 * card); everything softer is worded as a tendency.
 */

export type Severity = "error" | "warning" | "note";

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
}

export interface DiagnoseInput {
  /** The URL actually fetched, after redirects. */
  pageUrl: string;
  tags: CardTags;
  /** og:image resolved to an absolute URL, or null if there wasn't one. */
  imageUrl: string | null;
  /** Null when there was no image URL to look at. */
  image: ImageInspection | null;
}

export interface Diagnosis {
  findings: Finding[];
  /** Things that are right, so a healthy page doesn't look like a blank. */
  passed: string[];
  verdict: "broken" | "degraded" | "good";
}

/** The shape every platform designs its large card around. */
export const IDEAL = { width: 1200, height: 630 };
const IDEAL_RATIO = IDEAL.width / IDEAL.height; // 1.905

/** Facebook's documented floor: below this, no image is shown at all. */
const HARD_MIN = { width: 200, height: 200 };
/** Below this Facebook drops to the small square layout. */
const LARGE_CARD_MIN = { width: 600, height: 315 };

/** X truncates a card title around here. */
const TITLE_TRUNCATES_AT = 70;

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, note: 2 };

function isAbsolute(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function protocolOf(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).protocol;
  } catch {
    return null;
  }
}

export function diagnose(input: DiagnoseInput): Diagnosis {
  const { tags, imageUrl, image, pageUrl } = input;
  const findings: Finding[] = [];
  const passed: string[] = [];
  const add = (f: Finding) => findings.push(f);

  const pageIsHttps = protocolOf(pageUrl) === "https:";

  // ---- Is there an image at all? ----

  if (!tags.ogImage && !tags.twitterImage) {
    add({
      id: "no-image",
      severity: "error",
      title: "No preview image",
      detail:
        "The page has no og:image, so every platform falls back to a bare text link. This is the single biggest thing costing you clicks.",
    });
  } else if (!tags.ogImage && tags.twitterImage) {
    add({
      id: "twitter-image-only",
      severity: "error",
      title: "Only X can find your image",
      detail:
        "You have twitter:image but no og:image. Facebook, LinkedIn, Slack, WhatsApp and Discord all read og:image and will show nothing.",
    });
  } else if (tags.ogImage) {
    passed.push("og:image is present");

    if (!isAbsolute(tags.ogImage)) {
      add({
        id: "relative-image",
        severity: "warning",
        title: "og:image is a relative path",
        detail: `It's written as "${tags.ogImage}". The Open Graph spec requires a full URL including the scheme and host, and several crawlers won't resolve a path on their own.`,
      });
    } else if (pageIsHttps && protocolOf(imageUrl) === "http:") {
      add({
        id: "insecure-image",
        severity: "warning",
        title: "Image is served over http",
        detail:
          "Your page is https but the image isn't. Platforms routinely drop mixed-content images rather than showing them.",
      });
    }
  }

  // ---- Can the image actually be used? ----

  if (image && !image.ok) {
    const fatal = image.fault === "unreachable" || image.fault === "not_an_image";
    add({
      id: `image-${image.fault}`,
      severity: fatal ? "error" : "warning",
      title:
        image.fault === "unreachable"
          ? "Your image can't be fetched"
          : image.fault === "not_an_image"
            ? "That URL isn't an image"
            : image.fault === "too_large"
              ? "Your image is very large"
              : "Your image format is a problem",
      detail: image.detail,
    });
  }

  if (image?.ok) {
    passed.push("Image loads and is a supported format");

    const { width, height } = image;
    if (width !== null && height !== null) {
      const ratio = width / height;

      if (width < HARD_MIN.width || height < HARD_MIN.height) {
        add({
          id: "image-tiny",
          severity: "error",
          title: `Image is ${width}×${height} — too small to appear`,
          detail: `Below ${HARD_MIN.width}×${HARD_MIN.height} platforms drop the image entirely. Aim for ${IDEAL.width}×${IDEAL.height}.`,
        });
      } else if (width < LARGE_CARD_MIN.width || height < LARGE_CARD_MIN.height) {
        add({
          id: "image-small",
          severity: "warning",
          title: `Image is ${width}×${height} — too small for a large card`,
          detail: `Under ${LARGE_CARD_MIN.width}×${LARGE_CARD_MIN.height} you get the small square thumbnail instead of the wide banner. ${IDEAL.width}×${IDEAL.height} is what every platform designs around.`,
        });
      } else if (width < IDEAL.width) {
        add({
          id: "image-soft",
          severity: "note",
          title: `Image is ${width}px wide`,
          detail: `It'll show, but under ${IDEAL.width}px it looks soft on high-density screens, which is most phones.`,
        });
      } else {
        passed.push(`Image is ${width}×${height} — large enough everywhere`);
      }

      if (width >= HARD_MIN.width && height >= HARD_MIN.height) {
        if (ratio < 1.4) {
          add({
            id: "image-aspect-tall",
            severity: "warning",
            title: `Image is ${ratio.toFixed(2)}:1, not ${IDEAL_RATIO.toFixed(2)}:1`,
            detail:
              ratio < 1.1
                ? "It's roughly square. In a wide card slot the top and bottom get cut off, which is how logos lose their heads."
                : "It's squarer than the slot platforms give it, so expect the top and bottom to be trimmed.",
          });
        } else if (ratio > 2.4) {
          add({
            id: "image-aspect-wide",
            severity: "warning",
            title: `Image is ${ratio.toFixed(2)}:1 — wider than the slot`,
            detail:
              "Very wide images get cropped at the sides, or letterboxed with bands above and below.",
          });
        } else {
          passed.push("Aspect ratio suits a wide card");
        }
      }
    }

    // A declared size that disagrees with the file is worse than no
    // declaration: crawlers lay the card out from the tag before the image
    // has finished downloading, then the real one arrives a different shape.
    const declaredW = Number(tags.ogImageWidth);
    const declaredH = Number(tags.ogImageHeight);
    if (
      width !== null &&
      height !== null &&
      Number.isFinite(declaredW) &&
      Number.isFinite(declaredH) &&
      declaredW > 0 &&
      declaredH > 0 &&
      (declaredW !== width || declaredH !== height)
    ) {
      add({
        id: "declared-size-mismatch",
        severity: "warning",
        title: "og:image:width and height don't match the file",
        detail: `You declare ${declaredW}×${declaredH}; the actual image is ${width}×${height}. Crawlers reserve space from the tags, so the card is laid out for a shape that never arrives.`,
      });
    }
  }

  // ---- Text ----

  if (!tags.ogTitle && !tags.htmlTitle) {
    add({
      id: "no-title",
      severity: "error",
      title: "No title at all",
      detail: "There's no og:title and no <title>, so the card has nothing to say.",
    });
  } else if (!tags.ogTitle) {
    add({
      id: "no-og-title",
      severity: "warning",
      title: "No og:title",
      detail: `Platforms fall back to your <title>, which is written for search results: "${tags.htmlTitle}". A card title should be shorter and written for a human scrolling a feed.`,
    });
  } else {
    passed.push("og:title is present");
    if (tags.ogTitle.length > TITLE_TRUNCATES_AT) {
      add({
        id: "title-long",
        severity: "note",
        title: `Title is ${tags.ogTitle.length} characters`,
        detail: `X cuts card titles around ${TITLE_TRUNCATES_AT}. Yours will end mid-sentence there, though LinkedIn and Slack show more.`,
      });
    }
  }

  if (!tags.ogDescription) {
    add({
      id: "no-og-description",
      severity: tags.metaDescription ? "note" : "warning",
      title: "No og:description",
      detail: tags.metaDescription
        ? "Most platforms fall back to your meta description, which is written for search engines rather than for a feed."
        : "There's no description anywhere, so the card is a title and an image with nothing underneath.",
    });
  } else {
    passed.push("og:description is present");
  }

  // ---- X-specific ----

  if (!tags.twitterCard) {
    add({
      id: "no-twitter-card",
      severity: "warning",
      title: "No twitter:card",
      detail:
        'X reads this tag to decide between the wide image and a small square thumbnail. Without it you don\'t get to choose. Add `<meta name="twitter:card" content="summary_large_image">`.',
    });
  } else if (tags.twitterCard === "summary" && image?.ok && (image.width ?? 0) >= LARGE_CARD_MIN.width) {
    add({
      id: "twitter-card-summary",
      severity: "warning",
      title: 'twitter:card is "summary"',
      detail: `You have a ${image.width}px-wide image but you've told X to show the small square thumbnail. Change it to "summary_large_image".`,
    });
  } else if (tags.twitterCard === "summary_large_image") {
    passed.push('twitter:card is "summary_large_image"');
  }

  if (!tags.ogUrl) {
    add({
      id: "no-og-url",
      severity: "note",
      title: "No og:url",
      detail:
        "Without a canonical URL, the same page shared with different tracking parameters is counted as several different pages.",
    });
  }

  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const verdict = findings.some((f) => f.severity === "error")
    ? "broken"
    : findings.some((f) => f.severity === "warning")
      ? "degraded"
      : "good";

  return { findings, passed, verdict };
}
