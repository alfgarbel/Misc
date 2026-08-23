import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import Nav from "@/components/Nav";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { consumeAuthToken } from "@/lib/tokens";

export const metadata: Metadata = { title: "Verify email" };
export const dynamic = "force-dynamic";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  let verified = false;
  if (token) {
    const db = getDb();
    const userId = await consumeAuthToken(db, token, "verify");
    if (userId) {
      await db
        .update(users)
        .set({ emailVerifiedAt: new Date() })
        .where(eq(users.id, userId));
      verified = true;
    }
  }
  return (
    <>
      <Nav />
      <main className="mx-auto flex max-w-6xl flex-col items-center px-6 py-24 text-center">
        {verified ? (
          <>
            <h1 className="text-3xl font-bold text-emerald-400">
              Email verified ✓
            </h1>
            <p className="mt-3 text-zinc-400">
              You&apos;re all set. Thanks for confirming your address.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold">This link didn&apos;t work</h1>
            <p className="mt-3 max-w-md text-zinc-400">
              The verification link is invalid, expired, or was already used.
              You can request a fresh one from the dashboard.
            </p>
          </>
        )}
        <Link
          href="/dashboard"
          className="mt-8 rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-500"
        >
          Go to dashboard
        </Link>
      </main>
    </>
  );
}
