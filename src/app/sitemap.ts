import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/stripe";
import { allPosts } from "@/lib/blog";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();
  const pages = ["", "/check", "/blog", "/templates", "/pricing", "/docs", "/signup"].map(
    (path) => ({
      url: `${base}${path}`,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    })
  );
  const posts = allPosts().map(({ meta }) => ({
    url: `${base}/blog/${meta.slug}`,
    lastModified: new Date(`${meta.date}T00:00:00Z`),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));
  return [...pages, ...posts];
}
