import { describe, it, expect } from "vitest";
import { createTestDb } from "./helpers";
import { provisionAccount } from "@/lib/accounts";
import {
  countTemplates,
  createTemplate,
  deleteTemplate,
  getOwnedTemplate,
  getTemplateBySlug,
  isValidSlug,
  slugify,
  specOf,
  updateTemplate,
  uniqueSlug,
} from "@/lib/templates";
import { starterSpec, templateSpecSchema } from "@/lib/og/spec";

async function seed() {
  const db = await createTestDb();
  const owner = await provisionAccount(db, { email: "o@example.com", passwordHash: "h" });
  const other = await provisionAccount(db, { email: "x@example.com", passwordHash: "h" });
  return { db, ownerId: owner.userId, otherId: other.userId };
}

describe("slugs", () => {
  it("accepts what can safely live in a URL", () => {
    expect(isValidSlug("launch")).toBe(true);
    expect(isValidSlug("blog-post-2")).toBe(true);
    expect(isValidSlug("a")).toBe(true);
  });

  it("rejects anything that would be ambiguous in a query string", () => {
    expect(isValidSlug("")).toBe(false);
    expect(isValidSlug("Launch")).toBe(false);
    expect(isValidSlug("-lead")).toBe(false);
    expect(isValidSlug("trail-")).toBe(false);
    expect(isValidSlug("has space")).toBe(false);
    expect(isValidSlug("a".repeat(41))).toBe(false);
  });

  it("derives a slug from a display name", () => {
    expect(slugify("Launch Card")).toBe("launch-card");
    expect(slugify("  Blog — Post!  ")).toBe("blog-post");
    expect(slugify("!!!")).toBe("template");
    expect(isValidSlug(slugify("Launch Card"))).toBe(true);
  });

  it("never produces a slug the validator would reject", () => {
    for (const name of ["a".repeat(80), "...", "-- x --", "Ünïcödé Ñame", "2026"]) {
      expect(isValidSlug(slugify(name))).toBe(true);
    }
  });

  it("resolves collisions within an account", async () => {
    const { db, ownerId } = await seed();
    await createTemplate(db, ownerId, { name: "Launch", spec: starterSpec() });
    expect(await uniqueSlug(db, ownerId, "Launch")).toBe("launch-2");
  });

  it("lets two accounts use the same slug", async () => {
    const { db, ownerId, otherId } = await seed();
    const a = await createTemplate(db, ownerId, { name: "Launch", spec: starterSpec() });
    const b = await createTemplate(db, otherId, { name: "Launch", spec: starterSpec() });
    expect(a.slug).toBe("launch");
    expect(b.slug).toBe("launch");
  });
});

describe("template storage", () => {
  it("round-trips a spec through the database", async () => {
    const { db, ownerId } = await seed();
    const spec = starterSpec();
    const row = await createTemplate(db, ownerId, { name: "Hero", spec });

    const read = await getOwnedTemplate(db, ownerId, row.id);
    expect(read).not.toBeNull();
    const parsed = specOf(read!);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual(spec);
  });

  it("looks a template up by the slug used in ?tpl=", async () => {
    const { db, ownerId } = await seed();
    await createTemplate(db, ownerId, { name: "Launch card", spec: starterSpec() });
    const found = await getTemplateBySlug(db, ownerId, "launch-card");
    expect(found?.name).toBe("Launch card");
  });

  it("scopes slug lookups to the account", async () => {
    const { db, ownerId, otherId } = await seed();
    await createTemplate(db, ownerId, { name: "Launch", spec: starterSpec() });
    expect(await getTemplateBySlug(db, otherId, "launch")).toBeNull();
  });

  it("will not read, update or delete another account's template", async () => {
    const { db, ownerId, otherId } = await seed();
    const row = await createTemplate(db, ownerId, { name: "Mine", spec: starterSpec() });

    expect(await getOwnedTemplate(db, otherId, row.id)).toBeNull();
    expect(await updateTemplate(db, otherId, row.id, { name: "Yours" })).toBeNull();
    expect(await deleteTemplate(db, otherId, row.id)).toBe(false);

    const still = await getOwnedTemplate(db, ownerId, row.id);
    expect(still?.name).toBe("Mine");
  });

  it("rejects an invalid spec instead of storing it", async () => {
    const { db, ownerId } = await seed();
    const row = await createTemplate(db, ownerId, { name: "Hero", spec: starterSpec() });
    const bad = { version: 1, background: { type: "solid", color: "not-a-colour" }, layers: [] };
    await expect(
      updateTemplate(db, ownerId, row.id, {
        spec: bad as unknown as ReturnType<typeof starterSpec>,
      })
    ).rejects.toThrow();
  });

  it("counts only the account's own templates", async () => {
    const { db, ownerId, otherId } = await seed();
    await createTemplate(db, ownerId, { name: "A", spec: starterSpec() });
    await createTemplate(db, ownerId, { name: "B", spec: starterSpec() });
    await createTemplate(db, otherId, { name: "C", spec: starterSpec() });
    expect(await countTemplates(db, ownerId)).toBe(2);
    expect(await countTemplates(db, otherId)).toBe(1);
  });

  it("keeps the slug when an update supplies an invalid one", async () => {
    const { db, ownerId } = await seed();
    const row = await createTemplate(db, ownerId, { name: "Hero", spec: starterSpec() });
    const updated = await updateTemplate(db, ownerId, row.id, { slug: "Not A Slug" });
    expect(updated?.slug).toBe(row.slug);
  });
});

describe("specOf", () => {
  it("refuses a row whose stored JSON is not a valid spec", async () => {
    const { db, ownerId } = await seed();
    const row = await createTemplate(db, ownerId, { name: "Hero", spec: starterSpec() });
    // Simulates a row written by an older or newer schema version.
    const broken = { ...row, spec: '{"version":1,"layers":[]}' };
    const parsed = specOf(broken);
    expect(parsed.success).toBe(false);
  });

  it("reports unparseable JSON rather than throwing", async () => {
    const { db, ownerId } = await seed();
    const row = await createTemplate(db, ownerId, { name: "Hero", spec: starterSpec() });
    const parsed = specOf({ ...row, spec: "{not json" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error).toMatch(/not valid JSON/);
  });
});

describe("starterSpec", () => {
  it("is valid and renders the standard placeholders", () => {
    const spec = starterSpec();
    expect(templateSpecSchema.safeParse(spec).success).toBe(true);
    expect(spec.layers.map((l) => l.id)).toEqual(["title", "subtitle"]);
  });
});
