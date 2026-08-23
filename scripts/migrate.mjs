import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const url = process.env.DATABASE_URL ?? "file:local.db";
const db = drizzle(
  createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN })
);

await migrate(db, { migrationsFolder: "./drizzle" });
console.log(`Migrations applied to ${url}`);
process.exit(0);
