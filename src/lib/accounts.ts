import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import type { Database } from "./db";
import { users, subscriptions } from "./db/schema";
import { createApiKey } from "./keys";
import { generateSigningSecret } from "./signing";
import { trialEndFor } from "./trial";
import type { GoogleProfile } from "./oauth";

export interface NewAccount {
  userId: string;
  /** Plaintext key, shown once. Null only if key creation somehow failed. */
  apiKey: string | null;
}

/**
 * Creates a user together with everything an account needs: a free
 * subscription row, a signing secret, and a first API key. Shared by the
 * password signup route and the Google callback so the two can't drift.
 */
export async function provisionAccount(
  db: Database,
  fields: {
    email: string;
    passwordHash?: string | null;
    googleId?: string | null;
    name?: string | null;
    emailVerified?: boolean;
  }
): Promise<NewAccount> {
  const userId = randomUUID();
  await db.insert(users).values({
    id: userId,
    email: fields.email,
    passwordHash: fields.passwordHash ?? null,
    googleId: fields.googleId ?? null,
    name: fields.name ?? null,
    signingSecret: generateSigningSecret(),
    emailVerifiedAt: fields.emailVerified ? new Date() : null,
    // Every new account can put real cards on a real site before deciding.
    trialEndsAt: trialEndFor(),
  });
  await db.insert(subscriptions).values({ userId, plan: "free" });
  const created = await createApiKey(db, userId, "Default");
  return { userId, apiKey: created?.key ?? null };
}

export interface GoogleSignInResult {
  userId: string;
  /** Set only when this sign-in created a brand-new account. */
  apiKey: string | null;
  outcome: "created" | "linked" | "existing";
}

/**
 * Resolves a Google profile to a local account, creating or linking as needed.
 *
 * Linking an existing password account by email address is only safe because
 * we require Google to assert the address is verified — otherwise anyone able
 * to set an arbitrary unverified address could take over that account.
 */
export async function signInWithGoogle(
  db: Database,
  profile: GoogleProfile
): Promise<GoogleSignInResult> {
  const byGoogleId = await db.query.users.findFirst({
    where: eq(users.googleId, profile.googleId),
  });
  if (byGoogleId) {
    return { userId: byGoogleId.id, apiKey: null, outcome: "existing" };
  }

  const byEmail = await db.query.users.findFirst({
    where: eq(users.email, profile.email),
  });
  if (byEmail) {
    if (!profile.emailVerified) {
      throw new Error("UNVERIFIED_GOOGLE_EMAIL");
    }
    await db
      .update(users)
      .set({
        googleId: profile.googleId,
        name: byEmail.name ?? profile.name,
        emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
      })
      .where(eq(users.id, byEmail.id));
    return { userId: byEmail.id, apiKey: null, outcome: "linked" };
  }

  const account = await provisionAccount(db, {
    email: profile.email,
    googleId: profile.googleId,
    name: profile.name,
    emailVerified: profile.emailVerified,
  });
  return { userId: account.userId, apiKey: account.apiKey, outcome: "created" };
}
