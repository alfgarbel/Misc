import { z } from "zod";

export const TEMPLATES = [
  "gradient",
  "minimal",
  "split",
  "terminal",
  "quote",
  "announce",
  "link",
] as const;
export type TemplateId = (typeof TEMPLATES)[number];

const hexColor = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const ogParamsSchema = z.object({
  template: z.enum(TEMPLATES).default("gradient"),
  title: z.string().min(1).max(200).default("Hello, world"),
  subtitle: z.string().max(300).optional(),
  site: z.string().max(100).optional(),
  theme: z.enum(["dark", "light"]).default("dark"),
  accent: z
    .string()
    .regex(hexColor, "accent must be a hex color like %23f43f5e")
    .default("#6366f1"),
});

export type OgParams = z.infer<typeof ogParamsSchema>;

export interface BrandDefaults {
  template?: string | null;
  theme?: string | null;
  accent?: string | null;
  site?: string | null;
}

/**
 * Fills in account-level defaults for parameters the request didn't specify.
 * Applied only to authenticated renders, after signature verification.
 */
export function applyBrandDefaults(
  searchParams: URLSearchParams,
  defaults: BrandDefaults
): URLSearchParams {
  const merged = new URLSearchParams(searchParams);
  for (const field of ["template", "theme", "accent", "site"] as const) {
    const value = defaults[field];
    if (value && !merged.get(field)) merged.set(field, value);
  }
  return merged;
}

export function parseOgParams(searchParams: URLSearchParams) {
  const raw: Record<string, string> = {};
  for (const k of ["template", "title", "subtitle", "site", "theme", "accent"]) {
    const v = searchParams.get(k);
    if (v !== null && v !== "") raw[k] = v;
  }
  return ogParamsSchema.safeParse(raw);
}
