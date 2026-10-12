import Image from "next/image";
import { showcaseSrc } from "@/lib/showcase";

/**
 * A prerendered example card, served through the image optimizer.
 *
 * The cards are 1200×630 PNGs, but most places show them a few hundred
 * pixels wide: a phone was downloading the full PNG for every tile in the
 * homepage grid. Going through next/image lets the browser pick a width
 * that matches `sizes` and get WebP or AVIF where it supports them.
 */
export default function ShowcaseImage({
  slug,
  alt,
  sizes,
  className,
  eager = false,
}: {
  slug: string;
  alt: string;
  /** How wide the image is laid out, so the browser picks the right file. */
  sizes: string;
  className?: string;
  /** For cards in the first screen, which shouldn't wait for lazy loading. */
  eager?: boolean;
}) {
  return (
    <Image
      src={showcaseSrc(slug)}
      alt={alt}
      width={1200}
      height={630}
      sizes={sizes}
      loading={eager ? "eager" : "lazy"}
      className={className}
    />
  );
}
