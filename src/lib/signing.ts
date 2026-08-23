import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import type { Database } from "./db";
import { users } from "./db/schema";

export function generateSigningSecret(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Canonical message for URL signing: every (name, value) pair except `sig`,
 * with decoded values, sorted by name then value, joined as "name=value" with
 * "&". Documented in /docs — client snippets must match this exactly.
 */
export function canonicalMessage(params: URLSearchParams): string {
  const entries = [...params.entries()]
    .filter(([k]) => k !== "sig")
    .sort(([ak, av], [bk, bv]) =>
      ak === bk ? av.localeCompare(bv) : ak.localeCompare(bk)
    );
  return entries.map(([k, v]) => `${k}=${v}`).join("&");
}

export function signParams(params: URLSearchParams, secret: string): string {
  return createHmac("sha256", secret)
    .update(canonicalMessage(params))
    .digest("hex");
}

export function verifySignature(
  params: URLSearchParams,
  secret: string
): boolean {
  const sig = params.get("sig");
  if (!sig || !/^[0-9a-f]{64}$/.test(sig)) return false;
  const expected = signParams(params, secret);
  return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
}

/** Builds a fully signed /api/og URL. Mirrors the snippet shown in the docs. */
export function buildSignedUrl(
  baseUrl: string,
  params: Record<string, string>,
  accountId: string,
  secret: string
): string {
  const p = new URLSearchParams(params);
  p.set("acct", accountId);
  p.set("sig", signParams(p, secret));
  return `${baseUrl.replace(/\/$/, "")}/api/og?${p.toString()}`;
}

/** Fetches (creating if missing) the user's signing secret. */
export async function getOrCreateSigningSecret(
  db: Database,
  userId: string
): Promise<string | null> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return null;
  if (user.signingSecret) return user.signingSecret;
  const secret = generateSigningSecret();
  await db.update(users).set({ signingSecret: secret }).where(eq(users.id, userId));
  return secret;
}

export async function rotateSigningSecret(
  db: Database,
  userId: string
): Promise<string> {
  const secret = generateSigningSecret();
  await db.update(users).set({ signingSecret: secret }).where(eq(users.id, userId));
  return secret;
}
