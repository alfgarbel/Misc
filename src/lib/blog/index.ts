import type { ComponentType } from "react";

/**
 * A tiny post registry rather than MDX.
 *
 * Posts are TSX modules, so they're typed, they use the same components as
 * the rest of the site, and there is no content pipeline to keep working.
 * If this ever grows past a couple of dozen posts it's worth revisiting;
 * until then a build step would cost more than it saves.
 */
export interface PostMeta {
  slug: string;
  title: string;
  /** One sentence. Used as the meta description and on the index. */
  description: string;
  /** ISO date. Shown to readers and used for ordering. */
  date: string;
  /** Short line for the post's own social card. */
  cardSubtitle: string;
  readingMinutes: number;
}

export interface Post {
  meta: PostMeta;
  Body: ComponentType;
}

import ogImageNotUpdating, {
  meta as ogImageNotUpdatingMeta,
} from "@/content/blog/og-image-not-updating";
import nextjsOgImage, { meta as nextjsOgImageMeta } from "@/content/blog/nextjs-og-image";
import astroOgImage, { meta as astroOgImageMeta } from "@/content/blog/astro-og-image";
import wordpressOgImage, { meta as wordpressOgImageMeta } from "@/content/blog/wordpress-og-image";
import webflowOgImage, { meta as webflowOgImageMeta } from "@/content/blog/webflow-og-image";

const POSTS: Post[] = [
  { meta: ogImageNotUpdatingMeta, Body: ogImageNotUpdating },
  { meta: nextjsOgImageMeta, Body: nextjsOgImage },
  { meta: astroOgImageMeta, Body: astroOgImage },
  { meta: wordpressOgImageMeta, Body: wordpressOgImage },
  { meta: webflowOgImageMeta, Body: webflowOgImage },
];

/** Newest first. */
export function allPosts(): Post[] {
  return [...POSTS].sort((a, b) => b.meta.date.localeCompare(a.meta.date));
}

export function postBySlug(slug: string): Post | null {
  return POSTS.find((p) => p.meta.slug === slug) ?? null;
}

export function formatPostDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
