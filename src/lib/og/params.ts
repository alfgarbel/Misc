import { z } from "zod";

export const TEMPLATES = ["gradient", "minimal", "split", "terminal"] as const;
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

export function parseOgParams(searchParams: URLSearchParams) {
  const raw: Record<string, string> = {};
  for (const k of ["template", "title", "subtitle", "site", "theme", "accent"]) {
    const v = searchParams.get(k);
    if (v !== null && v !== "") raw[k] = v;
  }
  return ogParamsSchema.safeParse(raw);
}
