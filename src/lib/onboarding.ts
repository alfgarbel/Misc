import { eq } from "drizzle-orm";
import type { Database } from "./db";
import { users } from "./db/schema";
import { resolveApiKey } from "./keys";
import { decodeEntities } from "./urlcard/extract";

export type InstallStatus =
  /** The page's og:image is an OGsmith card rendered for this account. */
  | "live"
  /** The page has no og:image at all. */
  | "no_image"
  /** It has one, but it isn't an OGsmith card. */
  | "not_ogsmith"
  /** It's an OGsmith card, but on someone else's key — or a revoked one. */
  | "other_account";

/**
 * Decides whether a page's og:image is this account's OGsmith card.
 *
 * The host is deliberately not checked: preview deployments, custom
 * domains and a staging copy all serve the same path. What proves the card
 * is ours is the credential in it — a key that resolves to this account,
 * or a signed URL naming it.
 */
export async function classifyOgImage(
  db: Database,
  userId: string,
  ogImage: string | null,
  pageUrl: string
): Promise<InstallStatus> {
  if (!ogImage) return "no_image";
  let image: URL;
  try {
    // Tag values come straight out of the markup, so "&" is still "&amp;".
    image = new URL(decodeEntities(ogImage.trim()), pageUrl);
  } catch {
    return "not_ogsmith";
  }
  if (image.pathname !== "/api/og") return "not_ogsmith";

  const acct = image.searchParams.get("acct");
  if (acct) return acct === userId ? "live" : "other_account";

  const key = image.searchParams.get("key");
  if (!key) return "other_account";
  const resolved = await resolveApiKey(db, key);
  return resolved?.userId === userId ? "live" : "other_account";
}

/** Longest URL we keep. Matches what the checker itself accepts. */
const MAX_URL_LENGTH = 2000;

/**
 * Remembers the page someone came from, once. A later visit to the checker
 * shouldn't overwrite the site they actually signed up for.
 */
export async function saveOnboardingUrl(
  db: Database,
  userId: string,
  url: string,
  { overwrite = false }: { overwrite?: boolean } = {}
): Promise<void> {
  const trimmed = url.trim().slice(0, MAX_URL_LENGTH);
  if (!trimmed) return;
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user || (user.onboardingUrl && !overwrite)) return;
  await db.update(users).set({ onboardingUrl: trimmed }).where(eq(users.id, userId));
}
