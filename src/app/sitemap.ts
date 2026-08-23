import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/stripe";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();
  return ["", "/templates", "/pricing", "/docs", "/signup"].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
