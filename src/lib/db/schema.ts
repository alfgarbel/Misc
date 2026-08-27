import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  unique,
  index,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  // Null for accounts that only ever signed in with Google.
  passwordHash: text("password_hash"),
  googleId: text("google_id").unique(),
  name: text("name"),
  signingSecret: text("signing_secret"),
  emailVerifiedAt: integer("email_verified_at", { mode: "timestamp" }),
  brandTemplate: text("brand_template"),
  brandTheme: text("brand_theme"),
  brandAccent: text("brand_accent"),
  brandSite: text("brand_site"),
  brandLogo: text("brand_logo"),
  // Bumped whenever anything that changes how existing cards render is
  // edited. Callers put it in the URL as ?v=, which is what actually
  // invalidates social and CDN caches — those key on the URL alone.
  cacheVersion: integer("cache_version").notNull().default(1),
  brandUpdatedAt: integer("brand_updated_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const authTokens = sqliteTable("auth_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "verify" | "reset"
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Default"),
  keyHash: text("key_hash").notNull().unique(),
  keyPrefix: text("key_prefix").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
});

export const keyUsage = sqliteTable(
  "key_usage",
  {
    keyId: text("key_id")
      .notNull()
      .references(() => apiKeys.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.keyId, t.month] })]
);

export const subscriptions = sqliteTable("subscriptions", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  plan: text("plan").notNull().default("free"),
  status: text("status").notNull().default("active"),
  currentPeriodEnd: integer("current_period_end", { mode: "timestamp" }),
});

export const usage = sqliteTable(
  "usage",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    count: integer("count").notNull().default(0),
    alert80At: integer("alert80_at", { mode: "timestamp" }),
    alert100At: integer("alert100_at", { mode: "timestamp" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.month] })]
);

/**
 * Images and font files uploaded for use in custom templates. Stored as
 * base64 in the row, the way brand logos already are: these are small,
 * capped, and read on the render path, so keeping them in the database
 * avoids a second service and a second failure mode.
 *
 * Rows are immutable — replacing an asset means uploading a new one — which
 * is what makes them safe to cache in-process by id.
 */
export const assets = sqliteTable(
  "assets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // "image" | "font"
    name: text("name").notNull(),
    // Sniffed from the file's own bytes, never taken from the upload.
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    data: text("data").notNull(), // base64, without the data: prefix
    // Fonts only: how the family is addressed from a template spec.
    fontFamily: text("font_family"),
    fontWeight: integer("font_weight"),
    fontStyle: text("font_style"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("assets_user_id_idx").on(t.userId)]
);

/**
 * A card design built in the visual editor. `spec` is the JSON layer
 * document; it is validated on write and again on read, since a row can
 * outlive the schema version that wrote it.
 */
export const templates = sqliteTable(
  "templates",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // How the template is addressed in a URL: ?tpl=<slug>.
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    spec: text("spec").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [unique("templates_user_slug_unique").on(t.userId, t.slug)]
);

export type User = typeof users.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type TemplateRow = typeof templates.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
