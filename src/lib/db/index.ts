import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

export type Database = LibSQLDatabase<typeof schema>;

let _client: Client | null = null;
let _db: Database | null = null;

export function getDb(): Database {
  if (!_db) {
    _client = createClient({
      url: process.env.DATABASE_URL ?? "file:local.db",
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    _db = drizzle(_client, { schema });
  }
  return _db;
}

export { schema };
