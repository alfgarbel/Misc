/**
 * Regenerates scripts/turso-setup.sql from the migration files.
 *
 * The Turso web console can't run drizzle-kit, so people who set the database
 * up from the browser paste this file instead. It must leave the database in
 * exactly the state the CLI migrator would, bookkeeping included — drizzle
 * identifies an applied migration by the SHA-256 of its .sql file, so the
 * hashes here are computed the same way.
 *
 *   node scripts/gen-turso-setup.mjs           # write the file
 *   node scripts/gen-turso-setup.mjs --check   # fail if it is out of date
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const journal = JSON.parse(
  readFileSync(join(root, "drizzle/meta/_journal.json"), "utf8")
);

const header = `-- OGsmith database setup
-- Paste this whole file into the Turso dashboard SQL editor and run it once.
-- It creates every table the app needs, and records the migrations exactly
-- as the command-line migrator would, so future migrations stay in sync.
`;

const sections = [];
const bookkeeping = [];

for (const entry of journal.entries) {
  const raw = readFileSync(join(root, `drizzle/${entry.tag}.sql`), "utf8");
  const statements = raw
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.endsWith(";") ? s : `${s};`));
  sections.push(
    `\n-- ---------- ${entry.tag} ----------\n${statements.join("\n")}\n`
  );
  const hash = createHash("sha256").update(raw).digest("hex");
  bookkeeping.push(
    `INSERT INTO __drizzle_migrations ("hash", "created_at") VALUES('${hash}', ${entry.when});`
  );
}

const out = `${header}${sections.join("")}
-- ---------- migration bookkeeping ----------
CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
\t\t\tid SERIAL PRIMARY KEY,
\t\t\thash text NOT NULL,
\t\t\tcreated_at numeric
\t\t);
${bookkeeping.join("\n")}
`;

const target = join(root, "scripts/turso-setup.sql");
if (process.argv.includes("--check")) {
  const current = readFileSync(target, "utf8");
  if (current !== out) {
    console.error(
      "scripts/turso-setup.sql is out of date. Run: node scripts/gen-turso-setup.mjs"
    );
    process.exit(1);
  }
  console.log("scripts/turso-setup.sql is up to date.");
} else {
  writeFileSync(target, out);
  console.log(`Wrote ${target}`);
}
